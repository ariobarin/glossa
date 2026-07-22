import assert from "node:assert/strict";
import test from "node:test";
import { moveGuidedSelection, renderGuidedMenu } from "./ui-guided.js";

test("guided selection wraps in both directions", () => {
  assert.equal(moveGuidedSelection(0, -1, 4), 3);
  assert.equal(moveGuidedSelection(3, 1, 4), 0);
});

test("guided menu keeps the primary action first and shows shortcuts", () => {
  const view = renderGuidedMenu("C:\\code\\glossa", 0, false);
  assert.match(view, /^Glossa  C:\\code\\glossa/m);
  assert.match(view, /› Expose workspace/);
  assert.match(view, /↑↓ move  enter select  q quit/);
});
