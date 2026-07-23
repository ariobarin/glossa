import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const executable = process.argv[2];
if (!executable) throw new Error("Pass the standalone executable path.");

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function run(args) {
  return spawnSync(executable, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      GLOSSA_RELAY_ORIGIN: "http://127.0.0.1:9",
      GLOSSA_WORKER_ORIGIN: "http://127.0.0.1:9",
    },
  });
}

const version = run(["--version"]);
assert.equal(version.status, 0, version.stderr);
assert.equal(version.stdout.trim(), packageJson.version);

const help = run(["help"]);
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /Usage:/);

const completions = run(["completions", "powershell"]);
assert.equal(completions.status, 0, completions.stderr);
assert.match(completions.stdout, /Register-ArgumentCompleter/);

const doctor = run(["doctor", "--json"]);
const report = JSON.parse(doctor.stdout);
assert.deepEqual(report.checks[0], {
  name: "Runtime",
  status: "pass",
  detail: "Self-contained Glossa executable.",
});
for (const name of ["Sign-in", "Device"]) {
  const check = report.checks.find((candidate) => candidate.name === name);
  assert.ok(check, `${name} check was missing`);
  assert.notEqual(check.status, "fail", `${name}: ${check.detail}`);
}

console.log(`Standalone smoke passed for ${executable}.`);
