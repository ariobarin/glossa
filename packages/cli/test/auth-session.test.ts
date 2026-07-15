import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenNeedsRefresh,
  loadUserProfile,
  refreshCredentials,
} from "../src/auth-session.js";
import type { StoredCredentials } from "../src/config-store.js";

const credentials: StoredCredentials = {
  issuer: "https://glossa.example.auth0.com/",
  clientId: "test-client-id",
  audience: "https://api.glossa.test",
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  tokenType: "Bearer",
  scope: "openid profile offline_access glossa:device",
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("access token expiry includes a refresh buffer", () => {
  const expiresAt = Date.parse(credentials.expiresAt);
  assert.equal(accessTokenNeedsRefresh(credentials, expiresAt - 60_001), false);
  assert.equal(accessTokenNeedsRefresh(credentials, expiresAt - 60_000), true);
});

test("refresh rotates tokens and preserves connection metadata", async () => {
  let saved: StoredCredentials | undefined;
  const refreshed = await refreshCredentials(credentials, {
    fetch: async (url, init) => {
      assert.equal(url, "https://glossa.example.auth0.com/oauth/token");
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("grant_type"), "refresh_token");
      assert.equal(body.get("client_id"), credentials.clientId);
      assert.equal(body.get("refresh_token"), credentials.refreshToken);
      assert.equal(body.get("client_secret"), null);
      return jsonResponse({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: credentials.scope,
      });
    },
    saveCredentials: async (value) => {
      saved = value;
      return "keyring";
    },
    now: () => 1_000_000,
  });

  assert.equal(refreshed.accessToken, "new-access-token");
  assert.equal(refreshed.refreshToken, "new-refresh-token");
  assert.equal(refreshed.expiresAt, "1970-01-01T01:16:40.000Z");
  assert.equal(refreshed.issuer, credentials.issuer);
  assert.equal(refreshed.clientId, credentials.clientId);
  assert.equal(refreshed.audience, credentials.audience);
  assert.deepEqual(saved, refreshed);
});

test("refresh keeps the current refresh token when rotation omits one", async () => {
  const refreshed = await refreshCredentials(credentials, {
    fetch: async () =>
      jsonResponse({
        access_token: "new-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    saveCredentials: async () => "keyring",
    now: () => 1_000_000,
  });
  assert.equal(refreshed.refreshToken, credentials.refreshToken);
});

test("revoked refresh credentials are removed", async () => {
  let deleted = false;
  await assert.rejects(
    refreshCredentials(credentials, {
      fetch: async () =>
        jsonResponse(
          { error: "invalid_grant", error_description: "Unknown or invalid refresh token." },
          403,
        ),
      deleteCredentials: async () => {
        deleted = true;
      },
    }),
    /Session expired\. Run Glossa again to sign in\./,
  );
  assert.equal(deleted, true);
});

test("whoami refreshes a rejected access token and returns the account", async () => {
  const requests: string[] = [];
  const responses = [
    jsonResponse({ error: "invalid_token" }, 401),
    jsonResponse({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    }),
    jsonResponse({ sub: "github|1234", name: "Ari", email: "ari@example.com" }),
  ];
  const result = await loadUserProfile(credentials, {
    fetch: async (url, init) => {
      requests.push(url);
      if (url.endsWith("/userinfo") && requests.length === 3) {
        assert.equal(init?.headers && (init.headers as Record<string, string>).authorization, "Bearer new-access-token");
      }
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
    saveCredentials: async () => "keyring",
    now: () => Date.parse(credentials.expiresAt) - 120_000,
  });

  assert.deepEqual(requests, [
    "https://glossa.example.auth0.com/userinfo",
    "https://glossa.example.auth0.com/oauth/token",
    "https://glossa.example.auth0.com/userinfo",
  ]);
  assert.deepEqual(result.profile, {
    sub: "github|1234",
    name: "Ari",
    email: "ari@example.com",
  });
  assert.equal(result.credentials.accessToken, "new-access-token");
});
