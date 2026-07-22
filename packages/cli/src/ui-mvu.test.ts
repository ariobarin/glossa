import assert from "node:assert/strict";
import test from "node:test";
import { initialMvuModel, renderMvu, updateMvu } from "./ui-mvu.js";

test("MVU update keeps terminal effects explicit and testable", () => {
  const idle = initialMvuModel("/work/glossa");
  const starting = updateMvu(idle, { type: "key", name: "enter" });
  assert.equal(starting.model.phase, "starting");
  assert.deepEqual(starting.effects, ["start"]);

  const connected = updateMvu(starting.model, {
    type: "session",
    event: { type: "status", status: { state: "connected", reconnected: false, legacyRelay: false } },
  });
  const stopping = updateMvu(connected.model, { type: "key", name: "enter" });
  assert.equal(stopping.model.phase, "stopping");
  assert.deepEqual(stopping.effects, ["stop"]);
});

test("MVU translates transport disconnection into the settled stopped state", () => {
  const connected = { ...initialMvuModel("/work/glossa"), phase: "connected" as const };
  const stopped = updateMvu(connected, {
    type: "session",
    event: { type: "status", status: { state: "disconnected" } },
  });
  assert.equal(stopped.model.phase, "stopped");
  assert.deepEqual(stopped.effects, []);
});

test("MVU view scales down without hiding the primary action", () => {
  const view = renderMvu(initialMvuModel("/work/glossa"), 40, 10, false);
  assert.match(view, /○ Ready/);
  assert.match(view, /Press Enter to expose this workspac/);
  assert.match(view, /enter connect  c clear  \? help  q quit/);
  assert.doesNotMatch(view, /Activity/);
});
