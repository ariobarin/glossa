import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) return await discover(candidate);
      return entry.isFile() && entry.name.endsWith(".test.js") ? [candidate] : [];
    }),
  );
  return files.flat();
}

const roots = process.argv.slice(2);
if (roots.length === 0) throw new Error("At least one compiled test directory is required.");

const files = (await Promise.all(roots.map(discover))).flat().sort();
if (files.length === 0) throw new Error("No compiled test files were found.");

const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
const exitCode = await new Promise((resolve) => {
  child.once("error", () => resolve(1));
  child.once("exit", (code) => resolve(code ?? 1));
});
await Promise.all(
  roots.map((root) => rm(root, { recursive: true, force: true })),
);
process.exitCode = exitCode;
