import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { WorkerJob } from "@glossa/protocol";
import { RouterState } from "../src/router-state.js";

function readJob(): WorkerJob {
  return {
    type: "read_file",
    requestId: randomUUID(),
    path: "README.md",
  };
}

test("router state keeps devices and polls account-scoped", async () => {
  const state = new RouterState();
  const firstAccount = randomUUID();
  const secondAccount = randomUUID();
  const deviceId = randomUUID();
  const generation = state.register(firstAccount, deviceId);

  assert.deepEqual(state.listDevices(firstAccount), [{ deviceId, path: "." }]);
  assert.deepEqual(state.listDevices(secondAccount), []);
  await assert.rejects(
    state.poll(secondAccount, deviceId, generation, 1),
    /unknown_device_generation/,
  );
});

test("router state accepts results only from the routed account and device", async () => {
  const state = new RouterState();
  const accountId = randomUUID();
  const otherAccount = randomUUID();
  const deviceId = randomUUID();
  const generation = state.register(accountId, deviceId);
  const job = readJob();
  const pending = state.enqueue(accountId, deviceId, job, 1_000);

  assert.deepEqual(await state.poll(accountId, deviceId, generation, 10), job);
  assert.equal(
    state.complete(otherAccount, deviceId, {
      requestId: job.requestId,
      ok: true,
      value: { content: "wrong" },
    }),
    false,
  );
  assert.equal(
    state.complete(accountId, deviceId, {
      requestId: job.requestId,
      ok: true,
      value: { content: "right" },
    }),
    true,
  );
  assert.deepEqual(await pending, {
    requestId: job.requestId,
    ok: true,
    value: { content: "right" },
  });
});

test("command routing remains account-scoped", () => {
  const state = new RouterState();
  const accountId = randomUUID();
  const deviceId = randomUUID();
  const commandId = randomUUID();
  state.rememberCommand(accountId, deviceId, commandId);
  assert.equal(state.deviceForCommand(accountId, commandId), deviceId);
  assert.equal(state.deviceForCommand(randomUUID(), commandId), null);
});
