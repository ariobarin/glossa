import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_COMMAND_TIMEOUT_MS,
  workerJobSchema,
} from "./index.js";

test("run command defaults to fifteen minutes", () => {
  const parsed = workerJobSchema.parse({
    type: "run_command",
    requestId: randomUUID(),
    argv: ["node", "--version"],
  });
  assert.equal(parsed.type, "run_command");
  assert.equal(parsed.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS);
});

test("run command rejects timeouts above sixty minutes", () => {
  assert.throws(() =>
    workerJobSchema.parse({
      type: "run_command",
      requestId: randomUUID(),
      argv: ["node", "--version"],
      timeoutMs: MAX_COMMAND_TIMEOUT_MS + 1,
    }),
  );
});
