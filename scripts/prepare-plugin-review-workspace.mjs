import {
  cp,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const markerName = ".glossa-review-fixture";
const markerContent = "glossa-plugin-review-fixture-v1\n";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const templateRoot = path.join(repositoryRoot, "review", "fixture-template");

const args = process.argv.slice(2);
const reset = args.includes("--reset");

if (args.some((arg) => arg !== "--reset") || args.length > 1) {
  throw new Error(
    "Usage: node scripts/prepare-plugin-review-workspace.mjs [--reset]",
  );
}

const target = path.join(repositoryRoot, ".review-workspace");

async function exists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

if (await exists(target)) {
  if (!reset) {
    throw new Error(
      `Target already exists: ${target}. Pass --reset to replace a recognized fixture.`,
    );
  }

  const marker = await readFile(path.join(target, markerName), "utf8").catch(
    () => "",
  );
  if (marker !== markerContent) {
    throw new Error(`Refusing to reset an unrecognized directory: ${target}`);
  }
  await rm(target, { recursive: true, force: false });
}

const staging = await mkdtemp(path.join(repositoryRoot, ".review-workspace-"));
try {
  await cp(templateRoot, staging, { recursive: true });
  await writeFile(path.join(staging, markerName), markerContent, "utf8");
  await rename(staging, target);
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}

console.log(`Prepared Glossa plugin review workspace at ${target}`);
