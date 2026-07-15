import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { selectExposureRoot } from "../src/worker/root-selection.js";

const execFileAsync = promisify(execFile);

test("root selection uses the current Git worktree", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-git-root-"));
  try {
    await execFileAsync("git", ["init"], { cwd: root, windowsHide: true });
    const nested = path.join(root, "src", "nested");
    await mkdir(nested, { recursive: true });
    const selected = await selectExposureRoot(undefined, false, nested);
    assert.equal(selected, await selectExposureRoot(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("root selection requires an explicit directory outside Git", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-no-git-"));
  try {
    await assert.rejects(selectExposureRoot(undefined, false, root));
    assert.equal(await selectExposureRoot(root), await selectExposureRoot(root, false, root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
