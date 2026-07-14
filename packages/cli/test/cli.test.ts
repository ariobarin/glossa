import assert from "node:assert/strict";
import test from "node:test";

test("the package exposes the glossa executable name", async () => {
  const packageJson = (await import("../package.json", { with: { type: "json" } })).default;
  assert.deepEqual(packageJson.bin, { glossa: "dist/main.js" });
});
