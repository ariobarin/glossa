import assert from "node:assert/strict";
import test from "node:test";
import type { StoredCredentials } from "./config-store.js";
import {
  enrollDevice,
  listDevices,
  renameDevice,
  revokeDevice,
} from "./relay-client.js";

const endpoints = {
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
const device = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Test PC",
  platform: "win32-x64",
  lastSeenAt: "2026-07-20T00:00:00.000Z",
  revokedAt: null,
  activeWorkers: 2,
};

test("lists devices with truthful active worker counts", async () => {
  const devices = await listDevices(endpoints, credentials, async (input, init) => {
    assert.equal(input, "https://mcp.glossa.test/v1/devices");
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer access");
    return Response.json({ devices: [device] });
  });
  assert.deepEqual(devices, [device]);
});

test("renames and revokes devices through the control API", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    if (init?.method === "PATCH") {
      return Response.json({ device: { ...device, name: "Build PC" } });
    }
    return new Response(null, { status: 204 });
  };
  const renamed = await renameDevice(
    endpoints,
    credentials,
    device.id,
    "Build PC",
    fetcher,
  );
  await revokeDevice(endpoints, credentials, device.id, fetcher);
  assert.equal(renamed.name, "Build PC");
  assert.deepEqual(requests, [
    { url: `https://mcp.glossa.test/v1/devices/${device.id}`, method: "PATCH" },
    { url: `https://mcp.glossa.test/v1/devices/${device.id}`, method: "DELETE" },
  ]);
});

test("rejects incomplete status responses", async () => {
  await assert.rejects(
    listDevices(endpoints, credentials, async () => Response.json({
      devices: [{ id: device.id, name: device.name, activeWorkers: 1 }],
    })),
    /invalid device list response/,
  );
});

test("accepts an older relay without inventing worker counts", async () => {
  const devices = await listDevices(endpoints, credentials, async () => Response.json({
    devices: [{
      id: device.id,
      name: device.name,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
    }],
  }));
  assert.equal(devices[0]?.activeWorkers, null);
});

test("device name conflicts point to direct CLI recovery", async () => {
  await assert.rejects(
    enrollDevice(
      endpoints,
      credentials,
      "Test PC",
      async () => Response.json(
        { error: "device_name_conflict" },
        { status: 409 },
      ),
    ),
    /glossa devices.*revoke the stale device/,
  );
});
