import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedChecksum,
  npmUpdateInvocation,
  selectStandaloneRelease,
  standaloneAssetName,
  updateGlossa,
} from "./update.js";

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

test("updates npm installations without loading account state", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const messages: string[] = [];
  await updateGlossa({
    standalone: false,
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

test("reports npm startup and exit failures", async () => {
  await assert.rejects(
    async () =>
      updateGlossa({
        standalone: false,
        run: () => ({ status: null, error: new Error("missing") }),
        log: () => undefined,
      }),
    /could not start npm: missing/,
  );
  await assert.rejects(
    async () =>
      updateGlossa({
        standalone: false,
        run: () => ({ status: 17 }),
        log: () => undefined,
      }),
    /exit 17/,
  );
});

test("maps supported platforms to direct-install assets", () => {
  assert.equal(
    standaloneAssetName("win32", "x64"),
    "glossa-windows-x64.exe",
  );
  assert.equal(
    standaloneAssetName("darwin", "arm64"),
    "glossa-macos-arm64",
  );
  assert.equal(standaloneAssetName("linux", "x64"), "glossa-linux-x64");
  assert.throws(() => standaloneAssetName("freebsd", "x64"), /Use npm/);
  assert.throws(() => standaloneAssetName("linux", "ia32"), /Use npm/);
});

test("selects the newest release containing both direct-install assets", () => {
  const selected = selectStandaloneRelease(
    [
      {
        draft: true,
        tag_name: "cli-v9.0.0",
        assets: [],
      },
      {
        draft: false,
        tag_name: "cli-v0.1.0-beta.10",
        assets: [
          {
            name: "glossa-linux-x64",
            browser_download_url: "https://example.test/glossa",
          },
          {
            name: "glossa-linux-x64.sha256",
            browser_download_url: "https://example.test/checksum",
          },
        ],
      },
    ],
    "glossa-linux-x64",
  );
  assert.deepEqual(selected, {
    version: "0.1.0-beta.10",
    binaryUrl: "https://example.test/glossa",
    checksumUrl: "https://example.test/checksum",
  });
});

test("parses only the checksum for the requested asset", () => {
  const hash = "a".repeat(64);
  assert.equal(
    expectedChecksum(
      `${"b".repeat(64)}  other\n${hash} *glossa-macos-x64\n`,
      "glossa-macos-x64",
    ),
    hash,
  );
  assert.throws(
    () => expectedChecksum(`${hash}  other\n`, "glossa-linux-x64"),
    /did not contain/,
  );
});

test("uses standalone updater for direct installations", async () => {
  const messages: string[] = [];
  await updateGlossa({
    standalone: true,
    updateStandalone: async () => "Updated Glossa to 0.1.0-beta.10.",
    log: (message) => messages.push(message),
  });
  assert.match(messages.join("\n"), /standalone/);
  assert.match(messages.join("\n"), /beta\.10/);
});
