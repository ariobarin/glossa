import assert from "node:assert/strict";
import test from "node:test";

import { loadAuthConfig } from "../src/auth-config.js";

test("fresh installs use the Glossa Auth0 tenant", () => {
  assert.deepEqual(loadAuthConfig({}), {
    issuer: "https://dev-fl2h5xhp6umeh74m.us.auth0.com/",
    clientId: "9mwnK9nTAd8q1kxnKIZxC1wodxzfWHg5",
    audience: "https://mcp.glossa.sh/",
    scope: "openid profile offline_access glossa:device",
  });
});

test("development environments can override public Auth0 metadata", () => {
  assert.deepEqual(
    loadAuthConfig({
      GLOSSA_AUTH0_ISSUER: "https://tenant.example.com/",
      GLOSSA_AUTH0_CLI_CLIENT_ID: "test-client",
      GLOSSA_AUTH0_AUDIENCE: "https://api.example.com/",
    }),
    {
      issuer: "https://tenant.example.com/",
      clientId: "test-client",
      audience: "https://api.example.com/",
      scope: "openid profile offline_access glossa:device",
    },
  );
});

test("blank overrides retain the built in configuration", () => {
  const config = loadAuthConfig({
    GLOSSA_AUTH0_ISSUER: " ",
    GLOSSA_AUTH0_CLI_CLIENT_ID: "",
    GLOSSA_AUTH0_AUDIENCE: "\t",
  });

  assert.equal(config.issuer, "https://dev-fl2h5xhp6umeh74m.us.auth0.com/");
  assert.equal(config.clientId, "9mwnK9nTAd8q1kxnKIZxC1wodxzfWHg5");
  assert.equal(config.audience, "https://mcp.glossa.sh/");
});
