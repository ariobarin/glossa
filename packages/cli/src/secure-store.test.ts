import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SecureStore } from "./secure-store.js";

async function withTempFile(run: (file: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "glossa-secure-store-"));
  try {
    await run(path.join(dir, "credentials.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("treats an unparseable keyring value as absent instead of throwing", async () => {
  await withTempFile(async (file) => {
    let deleted = false;
    const store = new SecureStore<{ token: string }>({
      account: "oauth",
      file,
      warning: "warned",
      parse: (serialized) => {
        const value = JSON.parse(serialized);
        if (typeof value !== "object" || value === null) {
          throw new Error("Stored credentials are invalid.");
        }
        return value;
      },
      warn: () => {},
      entryProvider: async () => ({
        getPassword: async () => "null",
        setPassword: async () => {},
        deleteCredential: async () => {
          deleted = true;
          return true;
        },
      }),
    });

    const loaded = await store.load();

    assert.equal(loaded, null);
    assert.equal(deleted, true);
  });
});

test("still loads valid keyring credentials", async () => {
  await withTempFile(async (file) => {
    const store = new SecureStore<{ token: string }>({
      account: "oauth",
      file,
      warning: "warned",
      parse: (serialized) => JSON.parse(serialized) as { token: string },
      warn: () => {},
      entryProvider: async () => ({
        getPassword: async () => JSON.stringify({ token: "abc" }),
        setPassword: async () => {},
        deleteCredential: async () => true,
      }),
    });

    const loaded = await store.load();

    assert.deepEqual(loaded, { value: { token: "abc" }, backend: "keyring" });
  });
});
