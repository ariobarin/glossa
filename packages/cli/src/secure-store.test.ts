import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("treats a missing native credential as empty", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-secure-store-"));
  t.after(async () => await rm(root, { recursive: true, force: true }));
  const warnings: string[] = [];
  const store = new SecureStore<string>({
    account: "oauth",
    file: path.join(root, "credentials.json"),
    warning: "file fallback",
    parse: (serialized) => serialized,
    warn: (message) => warnings.push(message),
    entryProvider: async () => ({
      setPassword: async () => undefined,
      getPassword: async () => null,
      deleteCredential: async () => false,
    }),
  });

  assert.equal(await store.load(), null);
  assert.deepEqual(warnings, []);
});

test("reports failed native credential deletion", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-secure-store-"));
  t.after(async () => await rm(root, { recursive: true, force: true }));
  const file = path.join(root, "credentials.json");
  await writeFile(file, "fallback-secret", "utf8");
  const store = new SecureStore<string>({
    account: "oauth",
    file,
    warning: "file fallback",
    parse: (serialized) => serialized,
    entryProvider: async () => ({
      setPassword: async () => undefined,
      getPassword: async () => "oauth-secret",
      deleteCredential: async () => {
        throw new Error("keyring unavailable");
      },
    }),
  });

  await assert.rejects(
    store.delete(),
    /credential store could not remove the Glossa credential/,
  );
  assert.equal((await store.load())?.value, "oauth-secret");
  await assert.rejects(readFile(file), { code: "ENOENT" });
});
