import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the package exposes the glossa executable name", async () => {
  const packageJson = (await import("../package.json", { with: { type: "json" } })).default;
  assert.deepEqual(packageJson.bin, { glossa: "dist/main.js" });
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  await access(path.join(packageRoot, packageJson.bin.glossa));
});
