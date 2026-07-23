import assert from "node:assert/strict";
import test from "node:test";
import type { StoredCredentials } from "./config-store.js";
import type { RelayDevice, RelayEndpoints } from "./relay-client.js";
import { WorkspaceStatusService } from "./status-service.js";

const credentials: StoredCredentials = {
  issuer: "https://identity.glossa.test/",
  clientId: "client",
  audience: "https://mcp.glossa.test/",
  accessToken: "access",
  expiresAt: "2099-01-01T00:00:00.000Z",
  tokenType: "Bearer",
};

const endpoints: RelayEndpoints = {
  relayOrigin: "https://mcp.glossa.test",
  workerOrigin: "https://worker.glossa.test",
};

const devices: RelayDevice[] = [{
  id: "device-1",
  name: "Laptop",
  platform: "win32-x64",
  lastSeenAt: "2026-07-23T12:00:00.000Z",
  revokedAt: null,
  activeWorkers: 1,
}];

test("loads profile and devices in parallel", async () => {
  let profileStarted = false;
  let devicesStarted = false;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = new WorkspaceStatusService(credentials, endpoints, {
    validCredentials: async (value) => value,
    loadUserProfile: async (value) => {
      profileStarted = true;
      await blocked;
      return {
        credentials: value,
        profile: { sub: "account-1", email: "dev@example.com" },
      };
    },
    listDevices: async () => {
      devicesStarted = true;
      await blocked;
      return devices;
    },
  });

  const pending = service.refresh(undefined, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(profileStarted, true);
  assert.equal(devicesStarted, true);
  release();

  const status = await pending;
  assert.equal(status.account, "dev@example.com");
  assert.equal(status.activeWorkers, 1);
});

test("returns relay status before the account profile finishes", async () => {
  let releaseProfile!: () => void;
  const profileBlocked = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });
  let accountUpdated!: () => void;
  const accountUpdate = new Promise<void>((resolve) => {
    accountUpdated = resolve;
  });
  const service = new WorkspaceStatusService(credentials, endpoints, {
    validCredentials: async (value) => value,
    loadUserProfile: async (value) => {
      await profileBlocked;
      return {
        credentials: value,
        profile: { sub: "account-1", email: "dev@example.com" },
      };
    },
    listDevices: async () => devices,
  });
  service.subscribe((status) => {
    if (status.account === "dev@example.com") accountUpdated();
  });

  const status = await service.refresh();
  assert.equal(status.account, "Loading account…");
  assert.equal(status.activeWorkers, 1);

  releaseProfile();
  await accountUpdate;
  assert.equal(service.peek()?.account, "dev@example.com");
});

test("caches account data and deduplicates concurrent refreshes", async () => {
  let profileCalls = 0;
  let deviceCalls = 0;
  const service = new WorkspaceStatusService(credentials, endpoints, {
    validCredentials: async (value) => value,
    loadUserProfile: async (value) => {
      profileCalls += 1;
      return {
        credentials: value,
        profile: { sub: "account-1", email: "dev@example.com" },
      };
    },
    listDevices: async () => {
      deviceCalls += 1;
      return devices;
    },
  });

  const [first, same] = await Promise.all([
    service.refresh(undefined, true),
    service.refresh(undefined, true),
  ]);
  assert.equal(first, same);
  assert.equal(service.peek(), first);
  assert.equal(profileCalls, 1);
  assert.equal(deviceCalls, 1);

  await service.refresh();
  assert.equal(profileCalls, 1);
  assert.equal(deviceCalls, 2);
});
