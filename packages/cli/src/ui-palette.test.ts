import assert from "node:assert/strict";
import test from "node:test";
import { completePaletteCommand, paletteEventLine, parsePaletteCommand, renderPaletteIntro } from "./ui-palette.js";

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


test("palette preserves authority-relevant activity wording", () => {
  assert.equal(paletteEventLine({
    type: "activity",
    phase: "finished",
    jobType: "run_command",
    requestId: "1234567890",
    ok: true,
  }), "Command started (12345678).");
  assert.equal(paletteEventLine({
    type: "activity",
    phase: "finished",
    jobType: "write_file",
    requestId: "abcdef0123",
    ok: false,
  }), "File write rejected (abcdef01).");
});
