import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileService } from "../src/worker/file-service.js";
import { WorkerError } from "../src/worker/errors.js";
import { PathPolicy } from "../src/worker/path-policy.js";
import { WorkspaceManager } from "../src/worker/workspace-manager.js";

async function fixture(leaseMs = 5 * 60 * 1000) {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-files-"));
  const policy = await PathPolicy.create(root);
  const workspaces = new WorkspaceManager(policy, leaseMs);
  const files = new FileService(policy, workspaces);
  const workspace = await workspaces.open(".");
  return { root, workspaces, files, workspaceId: workspace.workspaceId };
}

function hasCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof WorkerError && error.code === code;
}

test("text files support revision-checked atomic writes", async () => {
  const context = await fixture();
  try {
    await writeFile(path.join(context.root, "note.txt"), "first", "utf8");
    const first = await context.files.readText(context.workspaceId, "note.txt");
    assert.equal(first.content, "first");

    const written = await context.files.writeText(
      context.workspaceId,
      "note.txt",
      "second",
      first.sha256,
    );
    assert.equal(await readFile(path.join(context.root, "note.txt"), "utf8"), "second");
    assert.equal(written.bytes, 6);

    await assert.rejects(
      context.files.writeText(context.workspaceId, "note.txt", "third", first.sha256),
      hasCode("stale_revision"),
    );
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});

test("workspace leases expire and are revalidated", async () => {
  const context = await fixture(5);
  try {
    await writeFile(path.join(context.root, "note.txt"), "first", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 15));
    await assert.rejects(
      context.files.readText(context.workspaceId, "note.txt"),
      hasCode("workspace_expired"),
    );
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});
