import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerJob, WorkerResult } from "@glossa/protocol";
import { RouterState } from "./router-state.js";

const accountId = "00000000-0000-4000-8000-000000000001";
const deviceId = "00000000-0000-4000-8000-000000000002";
const firstWorkerId = "00000000-0000-4000-8000-000000000003";
const secondWorkerId = "00000000-0000-4000-8000-000000000004";

test("routes multiple workers enrolled on one computer independently", async () => {
  const state = new RouterState();
  const firstGeneration = state.register(accountId, deviceId, "Test PC", firstWorkerId);
  state.register(accountId, deviceId, "Test PC", secondWorkerId);

  assert.equal(state.activeWorkerCount(accountId, deviceId), 2);
  assert.deepEqual(state.listDevices(accountId), [
    { deviceId: firstWorkerId, name: "Test PC", path: "." },
    { deviceId: secondWorkerId, name: "Test PC", path: "." },
  ]);

  const job: WorkerJob = {
    type: "read_file",
    requestId: "00000000-0000-4000-8000-000000000005",
    path: "README.md",
  };
  const poll = state.poll(accountId, deviceId, firstWorkerId, firstGeneration, 100);
  const pending = state.enqueue(accountId, firstWorkerId, job, 1_000);
  assert.deepEqual(await poll, job);

  const result: WorkerResult = {
    requestId: job.requestId,
    ok: true,
    value: { content: "ok" },
  };
  assert.equal(state.complete(accountId, firstWorkerId, result), true);
  assert.deepEqual(await pending, result);

  state.unregisterWorker(accountId, deviceId, firstWorkerId);
  assert.equal(state.activeWorkerCount(accountId, deviceId), 1);
  assert.deepEqual(state.listDevices(accountId), [
    { deviceId: secondWorkerId, name: "Test PC", path: "." },
  ]);
});

test("reconnecting one worker does not displace another", () => {
  const state = new RouterState();
  state.register(accountId, deviceId, "Test PC", firstWorkerId);
  state.register(accountId, deviceId, "Test PC", secondWorkerId);
  state.register(accountId, deviceId, "Test PC", firstWorkerId);
  assert.equal(state.activeWorkerCount(accountId, deviceId), 2);
});

test("preserves command routing when a stale worker reconnects", (t) => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const state = new RouterState();
  state.register(accountId, deviceId, "Test PC", firstWorkerId);
  state.rememberCommand(accountId, firstWorkerId, "command-1");

  now += 45_001;
  state.register(accountId, deviceId, "Test PC", firstWorkerId);

  assert.equal(
    state.workerForCommand(accountId, "command-1"),
    firstWorkerId,
  );
});
