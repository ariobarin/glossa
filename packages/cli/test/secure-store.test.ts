import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SecureStore } from "../src/secure-store.js";

interface Credential {
  token: string;
}

function parseCredential(serialized: string): Credential {
  const parsed = JSON.parse(serialized) as Partial<Credential>;
  if (typeof parsed.token !== "string") throw new Error("invalid credential");
  return { token: parsed.token };
}

test("secure storage prefers the operating-system keyring", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-keyring-"));
  const file = path.join(directory, "credential.json");
  let stored: string | undefined;
  const store = new SecureStore<Credential>({
    account: "test",
    file,
    warning: "fallback",
    parse: parseCredential,
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
    assert.equal(await store.save({ token: "secret" }), "keyring");
    assert.deepEqual(await store.load(), {
      value: { token: "secret" },
      backend: "keyring",
    });
    await store.delete();
    assert.equal(await store.load(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("secure storage warns and uses a private file fallback", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-file-store-"));
  const credentialDirectory = path.join(directory, "nested");
  const file = path.join(credentialDirectory, "credential.json");
  const warnings: string[] = [];
  const store = new SecureStore<Credential>({
    account: "test",
    file,
    warning: "fallback",
    parse: parseCredential,
    warn: (message) => warnings.push(message),
    entryProvider: async () => null,
  });
  try {
    assert.equal(await store.save({ token: "secret" }), "file");
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), {
      token: "secret",
    });
    assert.deepEqual(await store.load(), {
      value: { token: "secret" },
      backend: "file",
    });
    assert.deepEqual(warnings, ["fallback", "fallback"]);
    if (process.platform !== "win32") {
      assert.equal((await stat(credentialDirectory)).mode & 0o777, 0o700);
      assert.equal((await stat(file)).mode & 0o777, 0o600);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("secure storage migrates a fallback file into the keyring", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-migrate-store-"));
  const file = path.join(directory, "credential.json");
  let stored: string | undefined;
  await writeFile(file, '{"token":"legacy"}\n', "utf8");
  const store = new SecureStore<Credential>({
    account: "test",
    file,
    warning: "fallback",
    parse: parseCredential,
    entryProvider: async () => ({
      async setPassword(value) {
        stored = value;
      },
      async getPassword() {
        return stored;
      },
      async deleteCredential() {
        return true;
      },
    }),
  });
  try {
    assert.deepEqual(await store.load(), {
      value: { token: "legacy" },
      backend: "keyring",
    });
    assert.equal(stored, '{"token":"legacy"}');
    await assert.rejects(readFile(file, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
