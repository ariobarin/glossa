import assert from "node:assert/strict";
import test from "node:test";
import type { StoredCredentials } from "../src/config-store.js";
import type { StoredDeviceCredential } from "../src/device-store.js";
import { deviceForSession } from "../src/worker/managed-session.js";

const endpoints = {
  relayOrigin: "https://staging.glossa.example",
  workerOrigin: "http://10.0.0.1:39100",
};
const login: StoredCredentials = {
  issuer: "https://identity.example.com/",
  clientId: "cli",
  audience: "https://mcp.glossa.sh/",
  accessToken: "access-token",
  expiresAt: "2099-01-01T00:00:00.000Z",
  tokenType: "Bearer",
};
const device: StoredDeviceCredential = {
  relayOrigin: endpoints.relayOrigin,
  deviceId: "11111111-1111-4111-8111-111111111111",
  deviceName: "ariolap",
  token:
    "gld_11111111-1111-4111-8111-111111111111_abcdefghijklmnopqrstuvwxyz1234567890AB",
};

test("managed sessions reuse the enrolled device credential", async () => {
  const resolved = await deviceForSession(endpoints, {
    loadDeviceCredential: async () => device,
    loadCredentials: async () => {
      throw new Error("login credentials should not be read");
    },
  });
  assert.deepEqual(resolved, device);
});

test("managed sessions enroll and store a device after login", async () => {
  let saved: StoredDeviceCredential | undefined;
  const resolved = await deviceForSession(endpoints, {
    loadDeviceCredential: async () => null,
    loadCredentials: async () => ({ credentials: login, backend: "keyring" }),
    validCredentials: async (value) => value,
    defaultDeviceName: () => "ariolap",
    enrollDevice: async (_endpoints, credentials, name) => {
      assert.equal(credentials, login);
      assert.equal(name, "ariolap");
      return device;
    },
    saveDeviceCredential: async (value) => {
      saved = value;
    },
  });
  assert.deepEqual(resolved, device);
  assert.deepEqual(saved, device);
});

test("managed sessions require login before first enrollment", async () => {
  await assert.rejects(
    deviceForSession(endpoints, {
      loadDeviceCredential: async () => null,
      loadCredentials: async () => null,
    }),
    /Not signed in/,
  );
});
