import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { CommandService } from "../src/worker/command-service.js";
import { MAX_TEXT_BYTES } from "@glossa/protocol";
import { WorkerError } from "../src/worker/errors.js";
import { PathPolicy } from "../src/worker/path-policy.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "glossa-commands-"));
  const policy = await PathPolicy.create(root);
  return {
    root,
    commands: new CommandService(policy),
  };
}

test("commands run asynchronously with the inherited environment", async () => {
  const context = await fixture();
  const key = "GLOSSA_TEST_INHERITED_VALUE";
  const previous = process.env[key];
  process.env[key] = "available";
  try {
    const started = await context.commands.start({
      argv: [
        process.execPath,
        "-e",
        `setTimeout(() => process.stdout.write(process.env.${key} ?? "missing"), 50)`,
      ],
      timeoutMs: 2_000,
    });
    assert.equal(started.status, "running");
    const completed = await context.commands.get(started.commandId, 1_000);
    assert.equal(completed.status, "succeeded");
    assert.equal(completed.stdout, "available");
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    await context.commands.shutdown();
    await rm(context.root, { recursive: true, force: true });
  }
});

test("only one command runs at a time and cancellation stops it", async () => {
  const context = await fixture();
  try {
    const started = await context.commands.start({
      argv: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
      timeoutMs: 2_000,
    });
    await assert.rejects(
      context.commands.start({
        argv: [process.execPath, "-e", "process.exit(0)"],
      }),
      (error) => error instanceof WorkerError && error.code === "command_busy",
    );
    const canceled = await context.commands.cancel(started.commandId);
    assert.equal(canceled.status, "canceled");
  } finally {
    await context.commands.shutdown();
    await rm(context.root, { recursive: true, force: true });
  }
});

test("command timeout terminates the process tree", async () => {
  const context = await fixture();
  const childPidFile = path.join(context.root, "child.pid");
  let childPid: number | undefined;
  try {
    const started = await context.commands.start({
      argv: [
        process.execPath,
        "-e",
        `const {spawn}=require("node:child_process");const {writeFileSync}=require("node:fs");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});writeFileSync(${JSON.stringify(childPidFile)},String(child.pid));setInterval(()=>{},1000);`,
      ],
      timeoutMs: 500,
    });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        childPid = Number(await readFile(childPidFile, "utf8"));
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await delay(25);
      }
    }
    assert.ok(childPid && Number.isInteger(childPid));
    const completed = await context.commands.get(started.commandId, 4_000);
    assert.equal(completed.status, "timed_out");
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        process.kill(childPid, 0);
      } catch {
        childPid = undefined;
        break;
      }
      await delay(25);
    }
    assert.equal(childPid, undefined, "the timed-out command left its child running");
  } finally {
    await context.commands.shutdown();
    if (childPid) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {
        // The child already exited.
      }
    }
    await rm(context.root, { recursive: true, force: true });
  }
});

test("command output is capped and marked as truncated", async () => {
  const context = await fixture();
  try {
    const started = await context.commands.start({
      argv: [
        process.execPath,
        "-e",
        `process.stdout.write("x".repeat(${MAX_TEXT_BYTES + 1}))`,
      ],
      timeoutMs: 2_000,
    });
    const completed = await context.commands.get(started.commandId, 2_000);
    assert.equal(completed.status, "succeeded");
    assert.equal(Buffer.byteLength(completed.stdout ?? ""), MAX_TEXT_BYTES);
    assert.equal(completed.stdoutTruncated, true);
  } finally {
    await context.commands.shutdown();
    await rm(context.root, { recursive: true, force: true });
  }
});
