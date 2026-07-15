import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

function requiredEnvironment(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgres://localhost/glossa",
    GLOSSA_PUBLIC_ORIGIN: "https://mcp.glossa.sh",
    GLOSSA_AUTH0_ISSUER: "https://tenant.example.com/",
    GLOSSA_AUTH0_AUDIENCE: "https://mcp.glossa.sh/",
  };
}

test("relay binds to loopback by default", () => {
  assert.equal(loadConfig(requiredEnvironment()).GLOSSA_BIND_HOST, "127.0.0.1");
});

test("relay accepts an explicit private interface address", () => {
  const environment = requiredEnvironment();
  environment.GLOSSA_BIND_HOST = "10.0.0.1";
  assert.equal(loadConfig(environment).GLOSSA_BIND_HOST, "10.0.0.1");
});

test("production requires an HTTPS public origin", () => {
  const environment = requiredEnvironment();
  environment.NODE_ENV = "production";
  environment.GLOSSA_PUBLIC_ORIGIN = "http://mcp.glossa.sh";
  assert.throws(() => loadConfig(environment), /must use HTTPS/);
});
