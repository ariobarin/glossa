import assert from "node:assert/strict";
import test from "node:test";
import type { StoredCredentials } from "../config-store.js";
import type { StoredDeviceCredential } from "../device-store.js";
import type { RelayEndpoints } from "../relay-client.js";
import { deviceForSession } from "./managed-session.js";

const endpoints: RelayEndpoints = {
  relayOrigin: "https://mcp.glossa.test",
  workerOrigin: "https://mcp.glossa.test",
};
const credentials: StoredCredentials = {
  issuer: "https://identity.glossa.test/",
  clientId: "client",
  audience: "https://mcp.glossa.test/",
  accessToken: "access",
  expiresAt: "2099-01-01T00:00:00.000Z",
  tokenType: "Bearer",
};
const loaded = { credentials, backend: "file" as const };
const enrolled: StoredDeviceCredential = {
  relayOrigin: endpoints.relayOrigin,
  deviceId: "00000000-0000-4000-8000-000000000001",
  deviceName: "Laptop",
  token: "gld_laptop_token",
};

test("enrolls with the requested device name on first enrollment", async () => {
  let enrolledName: string | undefined;
  const result = await deviceForSession(endpoints, {
    loadDeviceCredential: async () => null,
    loadCredentials: async () => loaded,
    validCredentials: async (value) => value,
    accountOwnsDevice: async () => false,
    enrollDevice: async (_endpoints, _credentials, name) => {
      enrolledName = name;
      return enrolled;
    },
    saveDeviceCredential: async () => undefined,
    defaultDeviceName: () => "HOSTNAME",
    deviceName: "Laptop",
  });
  assert.equal(enrolledName, "Laptop");
  assert.equal(result.deviceName, "Laptop");
});

test("keeps the existing device and ignores a requested name once enrolled", async () => {
  const stored: StoredDeviceCredential = {
    relayOrigin: endpoints.relayOrigin,
    deviceId: "00000000-0000-4000-8000-000000000002",
    deviceName: "Old Desk",
    token: "gld_old_token",
  };
  let enrollCalled = false;
  const result = await deviceForSession(endpoints, {
    loadDeviceCredential: async () => stored,
    loadCredentials: async () => loaded,
    validCredentials: async (value) => value,
    accountOwnsDevice: async () => true,
    enrollDevice: async () => {
      enrollCalled = true;
      return enrolled;
    },
    saveDeviceCredential: async () => undefined,
    defaultDeviceName: () => "HOSTNAME",
    deviceName: "Laptop",
  });
  assert.equal(enrollCalled, false);
  assert.equal(result.deviceName, "Old Desk");
});

test("falls back to the default device name when none is requested", async () => {
  let enrolledName: string | undefined;
  await deviceForSession(endpoints, {
    loadDeviceCredential: async () => null,
    loadCredentials: async () => loaded,
    validCredentials: async (value) => value,
    accountOwnsDevice: async () => false,
    enrollDevice: async (_endpoints, _credentials, name) => {
      enrolledName = name;
      return enrolled;
    },
    saveDeviceCredential: async () => undefined,
    defaultDeviceName: () => "HOSTNAME",
  });
  assert.equal(enrolledName, "HOSTNAME");
});
