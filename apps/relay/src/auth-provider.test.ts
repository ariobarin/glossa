import assert from "node:assert/strict";
import test from "node:test";
import { subjectUsesAllowedProvider } from "./auth.js";
import { loadConfig } from "./config.js";

function config(environment: NodeJS.ProcessEnv = {}) {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    GLOSSA_PUBLIC_ORIGIN: "https://mcp.glossa.test",
    GLOSSA_AUTH0_ISSUER: "https://identity.glossa.test/",
    GLOSSA_AUTH0_AUDIENCE: "https://mcp.glossa.test/",
    ...environment,
  });
}

test("managed identity defaults to Google subjects", () => {
  const managed = config();

  assert.equal(
    subjectUsesAllowedProvider(managed, "google-oauth2|123456789"),
    true,
  );
  assert.equal(subjectUsesAllowedProvider(managed, "github|123456789"), false);
});

test("self-hosted relays can select another Auth0 provider", () => {
  const selfHosted = config({
    GLOSSA_AUTH0_ALLOWED_SUBJECT_PREFIX: "github|",
  });

  assert.equal(subjectUsesAllowedProvider(selfHosted, "github|123456789"), true);
  assert.equal(
    subjectUsesAllowedProvider(selfHosted, "google-oauth2|123456789"),
    false,
  );
});

test("provider prefixes must include the Auth0 separator", () => {
  assert.throws(
    () => config({ GLOSSA_AUTH0_ALLOWED_SUBJECT_PREFIX: "google-oauth2" }),
    /Auth0 subject prefix must end with \|/,
  );
});
