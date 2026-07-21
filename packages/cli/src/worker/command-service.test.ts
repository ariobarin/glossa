import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MAX_TEXT_BYTES } from "@glossa/protocol";
import { CommandService } from "./command-service.js";
import { PathPolicy } from "./path-policy.js";

async function commandFixture(
  context: test.TestContext,
): Promise<{ root: string; commands: CommandService }> {
  const createdRoot = await mkdtemp(
    path.join(os.tmpdir(), "glossa-command-test-"),
  );
  const policy = await PathPolicy.create(createdRoot);
  const commands = new CommandService(policy);
  context.after(async () => {
    await commands.shutdown();
    await rm(createdRoot, { force: true, recursive: true });
  });
  return { root: policy.root, commands };
}

test("runs PowerShell inside the exposed root", async (context) => {
  const { root, commands } = await commandFixture(context);
  const started = await commands.start({
    shellCommand: "Write-Output (Get-Location).Path",
    timeoutMs: 10_000,
  });
  const completed = await commands.get(started.commandId, 15_000);

  assert.equal(completed.status, "succeeded");
  assert.equal(completed.exitCode, 0);
  assert.equal(completed.stdout?.trim().toLowerCase(), root.toLowerCase());
  assert.equal(completed.stderr, "");
});

test("terminates a PowerShell process after its timeout", async (context) => {
  const { commands } = await commandFixture(context);
  const started = await commands.start({
    shellCommand: "Start-Sleep -Seconds 30",
    timeoutMs: 100,
  });
  const completed = await commands.get(started.commandId, 15_000);

  assert.equal(completed.status, "timed_out");
});

test("truncates command output at a complete UTF-8 character", async (context) => {
  const { commands } = await commandFixture(context);
  const started = await commands.start({
    argv: [
      process.execPath,
      "-e",
      `process.stdout.write("a".repeat(${MAX_TEXT_BYTES - 1}) + "\\u20ac")`,
    ],
    timeoutMs: 10_000,
  });
  const completed = await commands.get(started.commandId, 15_000);

  assert.equal(completed.status, "succeeded");
  assert.equal(completed.stdout, "a".repeat(MAX_TEXT_BYTES - 1));
  assert.equal(completed.stdoutTruncated, true);
  assert.ok(Buffer.byteLength(completed.stdout) <= MAX_TEXT_BYTES);
});
