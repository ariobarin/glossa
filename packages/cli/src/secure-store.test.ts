import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SecureStore } from "./secure-store.js";

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
