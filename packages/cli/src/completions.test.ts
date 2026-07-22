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
  const script = completionScript("powershell");
  assert.match(script, /Register-ArgumentCompleter -Native -CommandName glossa/);
  // The command fallback is gated to the first argument position, derived from
  // the cursor vs. the last token, so an empty glossa <TAB> still offers
  // commands while path positions fall through to filesystem completion.
  assert.match(script, /\$cursorPosition -gt \$last\.Extent\.EndOffset/);
  assert.match(script, /if \(\$position -eq 1\)/);
});

test("bash installs a complete -F handler with a filename fallback", () => {
  const script = completionScript("bash");
  assert.match(script, /^_glossa\(\) \{/m);
  assert.match(script, /complete -o default -F _glossa glossa/);
  assert.match(script, /\$\{COMP_WORDS\[COMP_CWORD\]\}/);
});

test("zsh declares a compdef handler and offers files for the path", () => {
  const script = completionScript("zsh");
  assert.match(script, /^#compdef glossa/);
  // Explicit registration so sourcing the script (not just autoloading) works.
  assert.match(script, /compdef _glossa glossa/);
  assert.match(script, /_files/);
});

test("fish keeps the workspace path completable", () => {
  const script = completionScript("fish");
  // No blanket -f disabling file completion at the root position.
  assert.doesNotMatch(script, /\ncomplete -c glossa -f\n/);
  assert.match(script, /__fish_use_subcommand/);
  assert.match(script, /__fish_seen_subcommand_from completions/);
});

test("scripts only advertise commands the parser actually accepts", () => {
  for (const shell of SUPPORTED_SHELLS) {
    const script = completionScript(shell);
    assert.ok(!script.includes("doctor"), `${shell} script advertised an unimplemented command`);
  }
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
