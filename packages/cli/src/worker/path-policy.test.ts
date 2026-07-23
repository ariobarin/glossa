import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { canonicalizeRoot } from "./path-policy.js";
import { WorkerError } from "./errors.js";

test("refuses the home directory with an actionable broad-root message", async () => {
  await assert.rejects(canonicalizeRoot(os.homedir()), (error: unknown) => {
    if (!(error instanceof WorkerError) || error.code !== "broad_root_refused") return false;
    return /home directory/.test(error.message) && /project directory/.test(error.message);
  });
});

test("refuses a filesystem root with an actionable broad-root message", async () => {
  const driveRoot = path.parse(process.cwd()).root;
  await assert.rejects(canonicalizeRoot(driveRoot), (error: unknown) => {
    if (!(error instanceof WorkerError) || error.code !== "broad_root_refused") return false;
    return /filesystem root/.test(error.message) && /project directory/.test(error.message);
  });
});
