import assert from "node:assert/strict";
import test from "node:test";
import {
  completionScript,
  SUPPORTED_SHELLS,
  type SupportedShell,
} from "./completions.js";

test("exposes the four supported shells", () => {
  assert.deepEqual([...SUPPORTED_SHELLS], ["powershell", "bash", "zsh", "fish"]);
});

test("every script mentions glossa and its core commands", () => {
  for (const shell of SUPPORTED_SHELLS) {
    const script = completionScript(shell);
    assert.ok(script.length > 0, `${shell} script was empty`);
    assert.ok(script.includes("glossa"), `${shell} script did not name glossa`);
    assert.ok(script.includes("start"), `${shell} script did not list start`);
    assert.ok(script.includes("status"), `${shell} script did not list status`);
    assert.ok(script.includes("completions"), `${shell} script did not list completions`);
  }
});

test("powershell registers a native argument completer", () => {
  assert.match(completionScript("powershell"), /Register-ArgumentCompleter -Native -CommandName glossa/);
});

test("bash installs a complete -F handler", () => {
  const script = completionScript("bash");
  assert.match(script, /^_glossa\(\) \{/m);
  assert.match(script, /complete -F _glossa glossa/);
  assert.match(script, /\$\{COMP_WORDS\[COMP_CWORD\]\}/);
});

test("zsh declares a compdef handler", () => {
  const script = completionScript("zsh");
  assert.match(script, /^#compdef glossa/);
  assert.match(script, /_glossa "\$@"/);
});

test("fish emits complete calls", () => {
  const script = completionScript("fish");
  assert.match(script, /^complete -c glossa -f$/m);
  assert.match(script, /__fish_use_subcommand/);
  assert.match(script, /__fish_seen_subcommand_from completions/);
});

test("every script offers the four completion shells", () => {
  for (const shell of SUPPORTED_SHELLS) {
    const script = completionScript(shell);
    for (const offered of SUPPORTED_SHELLS) {
      assert.ok(
        script.includes(offered),
        `${shell} script did not offer the ${offered} shell`,
      );
    }
  }
});
