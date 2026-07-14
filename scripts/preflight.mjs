import { access, readFile } from "node:fs/promises";
import process from "node:process";

const required = [
  "START_HERE.md",
  "AGENTS.md",
  "TASKS.md",
  "LOGIN_CHECKPOINTS.md",
  "optional/README.md",
  "package.json",
  "packages/cli/package.json",
  "packages/protocol/package.json",
  "apps/relay/package.json",
];

const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (major < 20) {
  console.error(`Node.js 20+ is required; found ${process.versions.node}`);
  process.exitCode = 1;
}

for (const path of required) {
  try {
    await access(path);
  } catch {
    console.error(`Missing required file: ${path}`);
    process.exitCode = 1;
  }
}

const manifest = JSON.parse(await readFile("MANIFEST.json", "utf8"));
if (manifest.cli_binary !== "glossa") {
  console.error("Manifest must define glossa as the CLI binary.");
  process.exitCode = 1;
}

if (manifest.lifecycle?.stage !== "unversioned prototype") {
  console.error("Manifest must mark the scaffold as an unversioned prototype.");
  process.exitCode = 1;
}

const cliPackage = JSON.parse(await readFile("packages/cli/package.json", "utf8"));
if (cliPackage.version !== "0.0.0" || cliPackage.private !== true) {
  console.error("The CLI package must remain private at 0.0.0 until the first numbered release.");
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("Glossa handoff preflight passed.");
}
