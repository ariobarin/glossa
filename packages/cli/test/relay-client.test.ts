import assert from "node:assert/strict";
import test from "node:test";
import type { StoredCredentials } from "../src/config-store.js";
import {
  accountOwnsDevice,
  enrollDevice,
  loadRelayEndpoints,
} from "../src/relay-client.js";

const credentials: StoredCredentials = {
  issuer: "https://identity.example.com/",
  clientId: "cli",
  audience: "https://mcp.glossa.sh/",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: "2099-01-01T00:00:00.000Z",
  tokenType: "Bearer",
};

test("relay endpoints default to the managed origin", () => {
  assert.deepEqual(loadRelayEndpoints({}), {
    relayOrigin: "https://mcp.glossa.sh",
    workerOrigin: "https://mcp.glossa.sh",
  });
});

test("worker polling may use a private staging address", () => {
  assert.deepEqual(
    loadRelayEndpoints({
      GLOSSA_RELAY_ORIGIN: "https://staging.glossa.example",
      GLOSSA_WORKER_ORIGIN: "http://10.0.0.1:39100",
    }),
    {
      relayOrigin: "https://staging.glossa.example",
      workerOrigin: "http://10.0.0.1:39100",
    },
  );
  assert.throws(
    () =>
      loadRelayEndpoints({
        GLOSSA_RELAY_ORIGIN: "http://example.com",
      }),
    /must use HTTPS/,
  );
  assert.throws(
    () =>
      loadRelayEndpoints({
        GLOSSA_WORKER_ORIGIN: "http://example.com",
      }),
    /must use HTTPS/,
  );
});

test("device enrollment uses the login token and validates the response", async () => {
  let request: RequestInit | undefined;
  const enrolled = await enrollDevice(
    {
      relayOrigin: "https://staging.glossa.example",
      workerOrigin: "http://10.0.0.1:39100",
    },
    credentials,
    "ariolap",
    async (_input, init) => {
      request = init;
      return Response.json(
        {
          device: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "ariolap",
          },
          device_token:
            "gld_11111111-1111-4111-8111-111111111111_abcdefghijklmnopqrstuvwxyz1234567890AB",
        },
        { status: 201 },
      );
    },
  );

  assert.equal(
    new Headers(request?.headers).get("authorization"),
    "Bearer access-token",
  );
  assert.equal(
    (JSON.parse(String(request?.body)) as { name: string }).name,
    "ariolap",
  );
  assert.equal(enrolled.relayOrigin, "https://staging.glossa.example");
  assert.equal(enrolled.deviceName, "ariolap");
});

test("device enrollment reports disabled accounts", async () => {
  await assert.rejects(
    enrollDevice(
      loadRelayEndpoints(),
      credentials,
      "ariolap",
      async () => Response.json({ error: "account_disabled" }, { status: 403 }),
    ),
    /disabled/,
  );
});

test("cached devices are reused only while active for the account", async () => {
  const endpoints = loadRelayEndpoints();
  const deviceId = "11111111-1111-4111-8111-111111111111";
  let authorization: string | null = null;
  const active = await accountOwnsDevice(
    endpoints,
    credentials,
    deviceId,
    async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization");
      return Response.json({
        devices: [
          { id: deviceId, revokedAt: null },
          { id: "22222222-2222-4222-8222-222222222222", revokedAt: null },
        ],
      });
    },
  );
  assert.equal(active, true);
  assert.equal(authorization, "Bearer access-token");

  assert.equal(
    await accountOwnsDevice(endpoints, credentials, deviceId, async () =>
      Response.json({
        devices: [{ id: deviceId, revokedAt: "2026-07-15T00:00:00.000Z" }],
      }),
    ),
    false,
  );
});
