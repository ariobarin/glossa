import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CredentialStore,
  FILE_CREDENTIAL_WARNING,
  type StoredCredentials,
} from "../src/config-store.js";

const credentials: StoredCredentials = {
  issuer: "https://glossa.example.auth0.com/",
  clientId: "test-client-id",
  audience: "https://api.glossa.test",
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  tokenType: "Bearer",
  scope: "openid offline_access",
};

class FakeEntry {
  value: string | undefined;

  async setPassword(password: string): Promise<void> {
    this.value = password;
  }

  async getPassword(): Promise<string | undefined> {
    return this.value;
  }

  async deleteCredential(): Promise<boolean> {
    const existed = this.value !== undefined;
    this.value = undefined;
    return existed;
  }
}

async function fixture(): Promise<{ directory: string; target: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-credentials-"));
  return { directory, target: path.join(directory, "credentials.json") };
}

test("credentials use the operating-system keyring when available", async (context) => {
  const { directory, target } = await fixture();
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const entry = new FakeEntry();
  const warnings: string[] = [];
  const store = new CredentialStore({
    credentialsFile: target,
    entryProvider: async () => entry,
    warn: (message) => warnings.push(message),
  });

  assert.equal(await store.save(credentials), "keyring");
  assert.deepEqual(await store.load(), { credentials, backend: "keyring" });
  await assert.rejects(access(target));
  assert.deepEqual(warnings, []);

  await store.delete();
  assert.equal(entry.value, undefined);
  assert.equal(await store.load(), null);
});

test("file fallback is explicit and mode restricted", async (context) => {
  const { directory, target } = await fixture();
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const warnings: string[] = [];
  const store = new CredentialStore({
    credentialsFile: target,
    entryProvider: async () => null,
    warn: (message) => warnings.push(message),
  });

  assert.equal(await store.save(credentials), "file");
  assert.deepEqual(JSON.parse(await readFile(target, "utf8")), credentials);
  if (process.platform !== "win32") {
    assert.equal((await stat(target)).mode & 0o777, 0o600);
  }
  assert.deepEqual(await store.load(), { credentials, backend: "file" });
  assert.deepEqual(warnings, [FILE_CREDENTIAL_WARNING, FILE_CREDENTIAL_WARNING]);
});

test("legacy credential files migrate into the keyring", async (context) => {
  const { directory, target } = await fixture();
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  await writeFile(target, JSON.stringify(credentials), { mode: 0o600 });
  const entry = new FakeEntry();
  const store = new CredentialStore({
    credentialsFile: target,
    entryProvider: async () => entry,
  });

  assert.deepEqual(await store.load(), { credentials, backend: "keyring" });
  await assert.rejects(access(target));
  assert.deepEqual(JSON.parse(entry.value ?? ""), credentials);
});

test("keyring write failure uses the warned fallback", async (context) => {
  const { directory, target } = await fixture();
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  const warnings: string[] = [];
  const entry = new FakeEntry();
  entry.setPassword = async () => {
    throw new Error("keyring unavailable");
  };
  const store = new CredentialStore({
    credentialsFile: target,
    entryProvider: async () => entry,
    warn: (message) => warnings.push(message),
  });

  assert.equal(await store.save(credentials), "file");
  assert.deepEqual(warnings, [FILE_CREDENTIAL_WARNING]);
  assert.deepEqual(JSON.parse(await readFile(target, "utf8")), credentials);
});

test("invalid keyring credentials fail without using a stale file", async (context) => {
  const { directory, target } = await fixture();
  context.after(async () => await rm(directory, { recursive: true, force: true }));
  await writeFile(target, JSON.stringify(credentials), { mode: 0o600 });
  const entry = new FakeEntry();
  entry.value = "not-json";
  const store = new CredentialStore({
    credentialsFile: target,
    entryProvider: async () => entry,
  });

  await assert.rejects(store.load(), new Error("Stored Glossa credentials are invalid."));
});
