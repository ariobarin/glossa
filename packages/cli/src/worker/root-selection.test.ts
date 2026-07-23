import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { selectExposureRoot } from "./root-selection.js";
import { WorkerError } from "./errors.js";

test("uses the current directory outside a git worktree", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "glossa-root-"));
  try {
    assert.equal(await selectExposureRoot(undefined, false, dir), await realpath(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("does not recommend an unguarded broad current directory", async () => {
  const filesystemRoot = path.parse(process.cwd()).root;
  await assert.rejects(
    selectExposureRoot(undefined, false, filesystemRoot),
    (error: unknown) => {
      return error instanceof WorkerError &&
        error.code === "broad_root_refused" &&
        error.message.includes("--allow-broad-root");
    },
  );
});

test("uses the git worktree root when no path is given", async () => {
  const root = await selectExposureRoot(undefined, false, process.cwd());
  assert.ok(path.isAbsolute(root));
  assert.ok(root.length > 0);
});
