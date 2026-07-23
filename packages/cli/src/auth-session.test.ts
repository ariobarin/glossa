import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenSubject,
  loadUserProfile,
  validCredentials,
} from "./auth-session.js";
import type { StoredCredentials } from "./config-store.js";

function credentials(overrides: Partial<StoredCredentials> = {}): StoredCredentials {
  return {
    issuer: "https://auth.glossa.test",
    clientId: "glossa-cli",
    audience: "https://relay.glossa.test",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    tokenType: "Bearer",
    ...overrides,
  };
}

test("reads the account subject from an Auth0 access token", () => {
  const payload = Buffer.from(JSON.stringify({
    sub: "google-oauth2|account-1",
  })).toString("base64url");
  assert.equal(
    accessTokenSubject(credentials({ accessToken: `header.${payload}.signature` })),
    "google-oauth2|account-1",
  );
  assert.throws(
    () => accessTokenSubject(credentials()),
    /could not identify the signed-in account/,
  );
});

test("aborts a pending credential refresh through the supplied signal", async () => {
  const controller = new AbortController();
  const pending = validCredentials(
    credentials({ expiresAt: new Date(0).toISOString() }),
    {
      signal: controller.signal,
      fetch: async (_input, init) => {
        assert.equal(init?.signal, controller.signal);
        return await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Refresh request did not receive an abort signal."));
            return;
          }
          const abort = () => reject(signal.reason);
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        });
      },
    },
  );

  controller.abort();

  await assert.rejects(pending, { name: "AbortError" });
});

test("passes the supplied signal to profile requests", async () => {
  const controller = new AbortController();
  const result = await loadUserProfile(credentials(), {
    signal: controller.signal,
    fetch: async (_input, init) => {
      assert.equal(init?.signal, controller.signal);
      return new Response(JSON.stringify({ sub: "user-1", email: "person@example.com" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(result.profile.sub, "user-1");
  assert.equal(result.profile.email, "person@example.com");
});
