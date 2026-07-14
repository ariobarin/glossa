import assert from "node:assert/strict";
import test from "node:test";
import {
  loginWithDeviceFlow,
  type DeviceFlowDependencies,
  type LoginOptions,
} from "../src/device-flow.js";
import type { StoredCredentials } from "../src/config-store.js";

const options: LoginOptions = {
  issuer: "https://glossa.example.auth0.com/",
  clientId: "test-client-id",
  audience: "https://api.glossa.test",
  scope: "openid profile offline_access glossa:device",
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deviceCode(complete = true): Record<string, unknown> {
  return {
    device_code: "device-code",
    user_code: "ABCD-EFGH",
    verification_uri: "https://glossa.example.auth0.com/activate",
    ...(complete
      ? { verification_uri_complete: "https://glossa.example.auth0.com/activate?user_code=ABCD-EFGH" }
      : {}),
    expires_in: 600,
    interval: 1,
  };
}

test("device login opens the complete URL and stores refresh credentials", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const logs: string[] = [];
  let saved: StoredCredentials | undefined;
  const responses = [
    jsonResponse(deviceCode()),
    jsonResponse({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: options.scope,
    }),
  ];
  const dependencies: DeviceFlowDependencies = {
    fetch: async (url, init) => {
      requests.push({ url, ...(init ? { init } : {}) });
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
    delay: async () => {},
    openBrowser: async (url) => {
      assert.equal(url, "https://glossa.example.auth0.com/activate?user_code=ABCD-EFGH");
      return true;
    },
    saveCredentials: async (credentials) => {
      saved = credentials;
      return "keyring";
    },
    now: () => 1_000_000,
    log: (message) => logs.push(message),
  };

  await loginWithDeviceFlow(options, dependencies);

  assert.equal(requests[0]?.url, "https://glossa.example.auth0.com/oauth/device/code");
  assert.equal(requests[1]?.url, "https://glossa.example.auth0.com/oauth/token");
  assert.equal((requests[0]?.init?.body as URLSearchParams).get("audience"), options.audience);
  assert.equal(
    (requests[1]?.init?.body as URLSearchParams).get("grant_type"),
    "urn:ietf:params:oauth:grant-type:device_code",
  );
  assert.deepEqual(saved, {
    issuer: options.issuer,
    clientId: options.clientId,
    audience: options.audience,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: "1970-01-01T01:16:40.000Z",
    tokenType: "Bearer",
    scope: options.scope,
  });
  assert.deepEqual(logs, [
    "Opened your browser for Glossa login.",
    "https://glossa.example.auth0.com/activate?user_code=ABCD-EFGH",
    "Signed in to Glossa.",
  ]);
});

test("device login shows the code and follows polling backoff", async () => {
  const waits: number[] = [];
  const logs: string[] = [];
  const responses = [
    jsonResponse(deviceCode(false)),
    jsonResponse({ error: "authorization_pending" }, 400),
    jsonResponse({ error: "slow_down" }, 400),
    jsonResponse({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    }),
  ];

  await loginWithDeviceFlow(options, {
    fetch: async () => {
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
    delay: async (milliseconds) => {
      waits.push(milliseconds);
    },
    openBrowser: async () => false,
    saveCredentials: async () => "keyring",
    now: () => 1_000_000,
    log: (message) => logs.push(message),
  });

  assert.deepEqual(waits, [1000, 1000, 6000]);
  assert.deepEqual(logs.slice(0, 3), [
    "Open this URL to sign in:",
    "https://glossa.example.auth0.com/activate",
    "Code: ABCD-EFGH",
  ]);
});

test("device login reports denial and code expiry", async (context) => {
  for (const scenario of [
    { oauth: "access_denied", message: "Login was denied." },
    { oauth: "expired_token", message: "The login code expired." },
  ]) {
    await context.test(scenario.oauth, async () => {
      const responses = [
        jsonResponse(deviceCode()),
        jsonResponse({ error: scenario.oauth }, 400),
      ];
      await assert.rejects(
        loginWithDeviceFlow(options, {
          fetch: async () => {
            const response = responses.shift();
            assert.ok(response);
            return response;
          },
          delay: async () => {},
          openBrowser: async () => true,
          log: () => {},
        }),
        new Error(scenario.message),
      );
    });
  }
});

test("device login can be interrupted while polling", async () => {
  const controller = new AbortController();
  let requests = 0;

  await assert.rejects(
    loginWithDeviceFlow(
      { ...options, signal: controller.signal },
      {
        fetch: async () => {
          requests += 1;
          return jsonResponse(deviceCode());
        },
        delay: async () => controller.abort(),
        openBrowser: async () => true,
        log: () => {},
      },
    ),
    new Error("Login canceled."),
  );
  assert.equal(requests, 1);
});

test("device login requires an offline refresh token", async () => {
  const responses = [
    jsonResponse(deviceCode()),
    jsonResponse({
      access_token: "access-token",
      expires_in: 3600,
      token_type: "Bearer",
    }),
  ];

  await assert.rejects(
    loginWithDeviceFlow(options, {
      fetch: async () => {
        const response = responses.shift();
        assert.ok(response);
        return response;
      },
      delay: async () => {},
      openBrowser: async () => true,
      log: () => {},
    }),
    new Error("Auth0 did not issue a refresh token."),
  );
});
