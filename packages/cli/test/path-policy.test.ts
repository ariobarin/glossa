import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WorkerError } from "../src/worker/errors.js";
import { PathPolicy } from "../src/worker/path-policy.js";

async function temporaryDirectory(name: string): Promise<string> {
  return await mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

function hasCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof WorkerError && error.code === code;
}

test("path policy rejects absolute paths and parent traversal", async () => {
  const root = await temporaryDirectory("glossa-paths");
  try {
    const policy = await PathPolicy.create(root);
    await assert.rejects(policy.resolveExisting("../outside"), hasCode("path_traversal"));
    await assert.rejects(
      policy.resolveExisting(path.join(path.parse(root).root, "outside")),
      hasCode("absolute_path"),
    );
    await assert.rejects(policy.resolveExisting("C:\\outside"), hasCode("absolute_path"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("path policy rejects symlink and junction escapes", async () => {
  const root = await temporaryDirectory("glossa-root");
  const outside = await temporaryDirectory("glossa-outside");
  try {
    await writeFile(path.join(outside, "secret.txt"), "outside", "utf8");
    const link = path.join(root, "linked");
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    const policy = await PathPolicy.create(root);
    await assert.rejects(
      policy.resolveExisting(path.join("linked", "secret.txt")),
      hasCode("linked_path"),
    );
    await assert.rejects(
      policy.resolveWritableFile(path.join("linked", "new.txt")),
      hasCode("linked_path"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("path policy resolves ordinary files inside the root", async () => {
  const root = await temporaryDirectory("glossa-paths");
  try {
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "index.ts"), "export {};", "utf8");
    const policy = await PathPolicy.create(root);
    assert.equal(
      await policy.resolveExisting(path.join("src", "index.ts")),
      path.join(policy.root, "src", "index.ts"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
