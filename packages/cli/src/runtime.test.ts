import assert from "node:assert/strict";
import test from "node:test";
import { isStandaloneExecutable } from "./runtime.js";

test("detects only Bun standalone executables", () => {
  assert.equal(isStandaloneExecutable({ isStandaloneExecutable: true }), true);
  assert.equal(isStandaloneExecutable({ isStandaloneExecutable: false }), false);
  assert.equal(isStandaloneExecutable({}), false);
  assert.equal(isStandaloneExecutable(undefined), false);
});
