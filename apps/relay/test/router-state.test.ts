import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { WorkerJob } from "@glossa/protocol";
import { RouterState } from "../src/router-state.js";

test("connected devices expose only device ID and root-relative path", () => {
  const state = new RouterState();
  const firstDevice = randomUUID();
  const secondDevice = randomUUID();
  state.register("account-a", firstDevice);
  state.register("account-b", secondDevice);

  assert.deepEqual(state.listDevices("account-a"), [
    { deviceId: firstDevice, path: "." },
  ]);
  assert.deepEqual(state.listDevices("account-b"), [
    { deviceId: secondDevice, path: "." },
  ]);
});

test("routing rejects a job from another account", async () => {
  const state = new RouterState();
  const deviceId = randomUUID();
  state.register("account-a", deviceId);
  const job: WorkerJob = {
    type: "open_workspace",
    requestId: randomUUID(),
    path: ".",
  };

  await assert.rejects(
    state.enqueue("account-b", deviceId, job, 100),
    /device_offline/,
  );
});
