import assert from "node:assert/strict";
import test from "node:test";
import { filterSpotlightItems, renderSpotlight, scoreSpotlightItem, spotlightItems } from "./ui-spotlight.js";

test("spotlight ranks direct action matches ahead of fuzzy matches", () => {
  assert.equal(filterSpotlightItems("stat")[0]?.action, "status");
  assert.equal(filterSpotlightItems("dev")[0]?.action, "devices");
  assert.ok(scoreSpotlightItem(spotlightItems[0]!, "ew") > 0);
});

test("spotlight renders an intentionally sparse search surface", () => {
  const view = renderSpotlight("/work/glossa", "dev", 0, false);
  assert.match(view, /^Glossa  \/work\/glossa/m);
  assert.match(view, /› dev▌/);
  assert.match(view, /› List devices/);
  assert.doesNotMatch(view, /Expose this workspace/);
});
