import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import { databaseOptions } from "./database-options.js";

const databaseUrl = "postgres://user:password@database.example/glossa";

test("verifies production database certificates", () => {
  const options = databaseOptions(databaseUrl, { NODE_ENV: "production" });
  const client = new Client(options);
  assert.deepEqual(
    (client as unknown as { connectionParameters: { ssl: unknown } })
      .connectionParameters.ssl,
    { rejectUnauthorized: true },
  );

  const customCaClient = new Client(
    databaseOptions(databaseUrl, {
      NODE_ENV: "production",
      GLOSSA_DATABASE_CA_PEM: "  trusted-ca  ",
    }),
  );
  assert.deepEqual(
    (customCaClient as unknown as { connectionParameters: { ssl: unknown } })
      .connectionParameters.ssl,
    { rejectUnauthorized: true, ca: "trusted-ca" },
  );
});

test("rejects production URL parameters that override TLS", () => {
  for (const parameter of [
    "ssl=false",
    "sslmode=disable",
    "sslmode=no-verify",
    "sslmode=require",
    "sslrootcert=database-ca.pem",
  ]) {
    assert.throws(
      () =>
        databaseOptions(`${databaseUrl}?${parameter}`, {
          NODE_ENV: "production",
        }),
      /must not contain SSL parameters/,
    );
  }
});

test("does not expose an invalid database URL in errors", () => {
  assert.throws(
    () => databaseOptions("not a URL with secret-password", { NODE_ENV: "production" }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "DATABASE_URL must be a valid Postgres URL." &&
      !error.message.includes("secret-password"),
  );
});

test("does not enable TLS for local development", () => {
  assert.deepEqual(databaseOptions(databaseUrl, { NODE_ENV: "development" }), {
    connectionString: databaseUrl,
    ssl: undefined,
  });
});
