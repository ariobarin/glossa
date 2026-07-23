import assert from "node:assert/strict";
import test from "node:test";
import { noActiveWorkerHint } from "./status-guidance.js";

test("hints when devices are enrolled but no worker is active", () => {
  assert.equal(
    noActiveWorkerHint(0, 2),
    'No active workers. Run "glossa" inside a workspace so ChatGPT can use it.',
  );
});

test("stays quiet when at least one worker is active", () => {
  assert.equal(noActiveWorkerHint(1, 2), null);
  assert.equal(noActiveWorkerHint(3, 2), null);
});

test("stays quiet when the relay did not report a worker count", () => {
  assert.equal(noActiveWorkerHint(null, 2), null);
});

test("leaves the empty-device message to the caller", () => {
  assert.equal(noActiveWorkerHint(0, 0), null);
});
