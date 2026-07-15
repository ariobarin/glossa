import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DeviceStore,
  FILE_DEVICE_WARNING,
  type StoredDeviceCredential,
} from "../src/device-store.js";

const credential: StoredDeviceCredential = {
  relayOrigin: "https://mcp.glossa.sh",
  deviceId: "11111111-1111-4111-8111-111111111111",
  deviceName: "test-device",
  token:
    "gld_11111111-1111-4111-8111-111111111111_abcdefghijklmnopqrstuvwxyz1234567890AB",
};

test("device credentials use the operating-system keyring", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-device-keyring-"));
  let stored: string | undefined;
  const store = new DeviceStore({
    credentialFile: path.join(directory, "device.json"),
    entryProvider: async () => ({
      async setPassword(value) {
        stored = value;
      },
      async getPassword() {
        return stored;
      },
      async deleteCredential() {
        stored = undefined;
        return true;
      },
    }),
  });

  try {
    await store.save(credential);
    assert.deepEqual(await store.load(), credential);
    await store.delete();
    assert.equal(await store.load(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("device credentials have an explicitly warned file fallback", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-device-"));
  const credentialFile = path.join(directory, "device.json");
  const warnings: string[] = [];
  const store = new DeviceStore({
    credentialFile,
    entryProvider: async () => null,
    warn: (message) => warnings.push(message),
  });
  try {
    await store.save(credential);
    assert.deepEqual(JSON.parse(await readFile(credentialFile, "utf8")), credential);
    assert.deepEqual(await store.load(), credential);
    assert.deepEqual(warnings, [FILE_DEVICE_WARNING, FILE_DEVICE_WARNING]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
