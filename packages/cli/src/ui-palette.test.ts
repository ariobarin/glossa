import assert from "node:assert/strict";
import test from "node:test";
import { completePaletteCommand, parsePaletteCommand, renderPaletteIntro } from "./ui-palette.js";

test("palette accepts explicit commands and two restrained aliases", () => {
  assert.equal(parsePaletteCommand(" status "), "status");
  assert.equal(parsePaletteCommand("?"), "help");
  assert.equal(parsePaletteCommand("q"), "quit");
  assert.equal(parsePaletteCommand("start now"), undefined);
});

test("palette completion keeps the command vocabulary discoverable", () => {
  assert.deepEqual(completePaletteCommand("st")[0], ["start", "stop", "status"]);
  assert.match(renderPaletteIntro("/work/glossa", false), /A small command surface/);
});
