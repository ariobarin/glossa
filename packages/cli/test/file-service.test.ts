import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileService } from "../src/worker/file-service.js";
import { WorkerError } from "../src/worker/errors.js";
import { PathPolicy } from "../src/worker/path-policy.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-files-"));
  const policy = await PathPolicy.create(root);
  const files = new FileService(policy);
  return { root, files };
}

function hasCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof WorkerError && error.code === code;
}

test("text files support revision-checked atomic writes", async () => {
  const context = await fixture();
  try {
    await writeFile(path.join(context.root, "note.txt"), "first", "utf8");
    const first = await context.files.readText("note.txt");
    assert.equal(first.content, "first");

    const written = await context.files.writeText(
      "note.txt",
      "second",
      first.sha256,
    );
    assert.equal(await readFile(path.join(context.root, "note.txt"), "utf8"), "second");
    assert.equal(written.bytes, 6);

    await assert.rejects(
      context.files.writeText("note.txt", "third", first.sha256),
      hasCode("stale_revision"),
    );
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("file operations remain confined to the exposed root", async () => {
  const context = await fixture();
  try {
    await writeFile(path.join(context.root, "note.txt"), "first", "utf8");
    await assert.rejects(
      context.files.readText("../note.txt"),
      hasCode("path_traversal"),
    );
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});
