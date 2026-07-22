import assert from "node:assert/strict";
import test from "node:test";
import { applyHudEvent, initialHudState, renderHud } from "./ui-hud.js";

test("hud reduces session events into a compact current state", () => {
  let state = initialHudState("/work/glossa");
  state = applyHudEvent(state, { type: "session", root: "/work/glossa", deviceName: "Dev PC" });
  state = applyHudEvent(state, { type: "status", status: { state: "connected", reconnected: false, legacyRelay: false } });
  state = applyHudEvent(state, { type: "activity", phase: "requested", jobType: "run_command", requestId: "1234567890" });
  assert.equal(state.connection, "connected");
  assert.equal(state.deviceName, "Dev PC");
  assert.equal(state.activities.at(-1)?.label, "Command requested");
  state = applyHudEvent(state, { type: "activity", phase: "finished", jobType: "run_command", requestId: "1234567890", ok: true });
  assert.equal(state.activities.at(-1)?.label, "Command started");
});

test("hud defaults to one calm status surface", () => {
  const view = renderHud({ ...initialHudState("/a/very/long/workspace/path"), connection: "connected" }, 42, false);
  assert.match(view, /● Connected/);
  assert.match(view, /ChatGPT can use this workspace\./);
  assert.match(view, /Authority  files and commands as this/);
  assert.match(view, /d details  \? help  q disconnect/);
  assert.doesNotMatch(view, /Recent activity/);
});
