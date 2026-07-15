import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalWorker } from "../src/worker/local-worker.js";

test("local worker handles the file and asynchronous command lifecycle", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-worker-"));
  const worker = await LocalWorker.create(root);
  try {
    await writeFile(path.join(root, "note.txt"), "first", "utf8");
    const read = await worker.handle({
      type: "read_file",
      requestId: randomUUID(),
      path: "note.txt",
    });
    assert.equal((read.value as { content: string }).content, "first");

    const written = await worker.handle({
      type: "write_file",
      requestId: randomUUID(),
      path: "note.txt",
      content: "second",
      expectedSha256: (read.value as { sha256: string }).sha256,
    });
    assert.equal(written.ok, true);
    assert.equal(await readFile(path.join(root, "note.txt"), "utf8"), "second");

    const started = await worker.handle({
      type: "run_command",
      requestId: randomUUID(),
      argv: [process.execPath, "-e", "process.stdout.write('done')"],
      timeoutMs: 2_000,
    });
    const commandId = (started.value as { commandId: string }).commandId;
    const completed = await worker.handle({
      type: "get_command",
      requestId: randomUUID(),
      commandId,
      waitMs: 2_000,
    });
    assert.equal((completed.value as { status: string }).status, "succeeded");
    assert.equal((completed.value as { stdout: string }).stdout, "done");
  } finally {
    await worker.shutdown();
    await rm(root, { recursive: true, force: true });
  }
});
