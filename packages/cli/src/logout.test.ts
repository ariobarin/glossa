import assert from "node:assert/strict";
import test from "node:test";
import type { StoredCredentials } from "./config-store.js";
import { browserLogoutUrl, logoutFromGlossa } from "./logout.js";

const credentials: StoredCredentials = {
  issuer: "https://identity.glossa.test/",
  clientId: "client",
  audience: "https://mcp.glossa.test/",
  accessToken: "access",
  expiresAt: "2099-01-01T00:00:00.000Z",
  tokenType: "Bearer",
};
const stored = { credentials, backend: "file" as const };

test("builds the Auth0 browser logout URL", () => {
  assert.equal(
    browserLogoutUrl("https://identity.glossa.test/"),
    "https://identity.glossa.test/v2/logout",
  );
});

test("local logout leaves the browser session alone", async () => {
  let removed = false;
  let opened = false;
  const messages: string[] = [];

  await logoutFromGlossa(
    { browser: false },
    {
      loadCredentials: async () => stored,
      deleteCredentials: async () => {
        removed = true;
      },
      openBrowser: async () => {
        opened = true;
        return true;
      },
      log: (message) => messages.push(message),
    },
  );

  assert.equal(removed, true);
  assert.equal(opened, false);
  assert.deepEqual(messages, ["Signed out of Glossa locally."]);
});

test("local logout reports already signed out but still clears stale state", async () => {
  let removed = false;
  let opened = false;
  const messages: string[] = [];

  await logoutFromGlossa(
    { browser: false },
    {
      // load() reports null, which also covers a keyring read failure that
      // SecureStore swallows while an entry still exists.
      loadCredentials: async () => null,
      deleteCredentials: async () => {
        removed = true;
      },
      openBrowser: async () => {
        opened = true;
        return true;
      },
      log: (message) => messages.push(message),
    },
  );

  assert.equal(removed, true);
  assert.equal(opened, false);
  assert.deepEqual(messages, ["Already signed out of Glossa locally."]);
});

test("browser logout opens the Auth0 session endpoint", async () => {
  let openedUrl: string | undefined;
  const messages: string[] = [];

  await logoutFromGlossa(
    { browser: true },
    {
      loadCredentials: async () => stored,
      deleteCredentials: async () => undefined,
      openBrowser: async (url) => {
        openedUrl = url;
        return true;
      },
      issuer: "https://identity.glossa.test/",
      log: (message) => messages.push(message),
    },
  );

  assert.equal(openedUrl, "https://identity.glossa.test/v2/logout");
  assert.match(messages.at(-1) ?? "", /same Google account/);
});

test("browser logout uses the stored session issuer", async () => {
  let openedUrl: string | undefined;

  await logoutFromGlossa(
    { browser: true },
    {
      loadCredentials: async () => ({
        credentials: { ...credentials, issuer: "https://stored-identity.glossa.test/" },
        backend: "file",
      }),
      deleteCredentials: async () => undefined,
      openBrowser: async (url) => {
        openedUrl = url;
        return true;
      },
      log: () => undefined,
    },
  );

  assert.equal(openedUrl, "https://stored-identity.glossa.test/v2/logout");
});

test("browser logout still opens when already signed out locally", async () => {
  let openedUrl: string | undefined;

  await logoutFromGlossa(
    { browser: true },
    {
      loadCredentials: async () => null,
      deleteCredentials: async () => undefined,
      openBrowser: async (url) => {
        openedUrl = url;
        return false;
      },
      issuer: "https://identity.glossa.test/",
      log: () => undefined,
    },
  );

  assert.equal(openedUrl, "https://identity.glossa.test/v2/logout");
});
