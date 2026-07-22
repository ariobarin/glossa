import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { selectExposureRoot } from "./root-selection.js";
import { WorkerError } from "./errors.js";

test("asks for a directory with an actionable hint outside a git worktree", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "glossa-root-"));
  try {
    await assert.rejects(selectExposureRoot(undefined, false, dir), (error: unknown) => {
      if (!(error instanceof WorkerError) || error.code !== "root_required") return false;
      return (
        error.message.includes(dir) &&
        /glossa start \./.test(error.message) &&
        /glossa start <path>/.test(error.message)
      );
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("uses the git worktree root when no path is given", async () => {
  const root = await selectExposureRoot(undefined, false, process.cwd());
  assert.ok(path.isAbsolute(root));
  assert.ok(root.length > 0);
});
