import assert from "node:assert/strict";
import test from "node:test";
import { browserLogoutUrl, logoutFromGlossa } from "./logout.js";

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
      deleteCredentials: async () => {
        removed = true;
      },
      openBrowser: async () => {
        opened = true;
        return true;
      },
      issuer: "https://identity.glossa.test/",
      log: (message) => messages.push(message),
    },
  );

  assert.equal(removed, true);
  assert.equal(opened, false);
  assert.deepEqual(messages, ["Signed out of Glossa locally."]);
});

test("browser logout opens the Auth0 session endpoint", async () => {
  let openedUrl: string | undefined;
  const messages: string[] = [];

  await logoutFromGlossa(
    { browser: true },
    {
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
      deleteCredentials: async () => undefined,
      loadStoredIssuer: async () => "https://stored-identity.glossa.test/",
      openBrowser: async (url) => {
        openedUrl = url;
        return true;
      },
      log: () => undefined,
    },
  );

  assert.equal(openedUrl, "https://stored-identity.glossa.test/v2/logout");
});
