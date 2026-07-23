import assert from "node:assert/strict";
import test from "node:test";
import { npmUpdateInvocation, updateGlossa } from "./update.js";

test("uses cmd for the fixed npm update on Windows", () => {
  assert.deepEqual(
    npmUpdateInvocation("win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "npm install --global @ariobarin/glossa@beta",
      ],
    },
  );
});

test("runs npm directly on other platforms", () => {
  assert.deepEqual(npmUpdateInvocation("linux", {}), {
    command: "npm",
    args: ["install", "--global", "@ariobarin/glossa@beta"],
  });
});

test("updates without loading login or device state", () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const messages: string[] = [];
  updateGlossa({
    platform: "win32",
    environment: { ComSpec: "cmd.exe" },
    run: (command, args) => {
      calls.push({ command, args });
      return { status: 0 };
    },
    log: (message) => messages.push(message),
  });
  assert.deepEqual(calls, [
    {
      command: "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "npm install --global @ariobarin/glossa@beta",
      ],
    },
  ]);
  assert.deepEqual(messages, [
    "Updating Glossa from the npm beta channel...",
    "Glossa updated.",
    "Next: run glossa to reopen this workspace.",
    "Inside Glossa, press ? for controls.",
  ]);
});

test("reports npm startup and exit failures", () => {
  assert.throws(
    () =>
      updateGlossa({
        run: () => ({ status: null, error: new Error("missing") }),
        log: () => undefined,
      }),
    /could not start npm: missing/,
  );
  assert.throws(
    () =>
      updateGlossa({
        run: () => ({ status: 17 }),
        log: () => undefined,
      }),
    /exit 17/,
  );
});
