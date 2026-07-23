import assert from "node:assert/strict";
import test from "node:test";
import { parseInvocation, UsageError } from "./cli-options.js";

test("uses one workspace entrypoint", () => {
  assert.deepEqual(parseInvocation([]), {
    command: "workspace",
  });
  assert.deepEqual(parseInvocation(["."]), {
    command: "workspace",
    path: ".",
  });
});

test("supports an explicit path", () => {
  assert.deepEqual(parseInvocation(["C:\\work\\project"]), {
    command: "workspace",
    path: "C:\\work\\project",
  });
  assert.deepEqual(parseInvocation(["--", "-workspace"]), {
    command: "workspace",
    path: "-workspace",
  });
});

test("keeps only standard metadata options outside the TUI", () => {
  assert.deepEqual(parseInvocation(["--help"]), { command: "help" });
  assert.deepEqual(parseInvocation(["-h"]), { command: "help" });
  assert.deepEqual(parseInvocation(["--version"]), { command: "version" });
  assert.deepEqual(parseInvocation(["-v"]), { command: "version" });
});

test("rejects extra paths and unknown options", () => {
  assert.throws(() => parseInvocation(["one", "two"]), UsageError);
  assert.throws(() => parseInvocation(["--json"]), UsageError);
});
