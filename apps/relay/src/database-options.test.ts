import assert from "node:assert/strict";
import test from "node:test";
import { databaseSsl } from "./database-options.js";

test("verifies production database certificates", () => {
  assert.deepEqual(databaseSsl({ NODE_ENV: "production" }), {
    rejectUnauthorized: true,
  });
  assert.deepEqual(
    databaseSsl({
      NODE_ENV: "production",
      GLOSSA_DATABASE_CA_PEM: "  trusted-ca  ",
    }),
    { rejectUnauthorized: true, ca: "trusted-ca" },
  );
});

test("does not enable TLS for local development", () => {
  assert.equal(databaseSsl({ NODE_ENV: "development" }), undefined);
});
