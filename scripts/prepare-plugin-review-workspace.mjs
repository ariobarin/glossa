import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const markerName = ".glossa-review-fixture";
const markerContent = "glossa-plugin-review-fixture-v1\n";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const templateRoot = path.join(repositoryRoot, "review", "fixture-template");

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const positional = args.filter((arg) => arg !== "--reset");

if (positional.length > 1 || positional.some((arg) => arg.startsWith("--"))) {
  throw new Error(
    "Usage: node scripts/prepare-plugin-review-workspace.mjs [target] [--reset]",
  );
}

const target = path.resolve(
  repositoryRoot,
  positional[0] ?? ".review-workspace",
);

if (target === repositoryRoot || target === path.parse(target).root) {
  throw new Error(
    "Refusing to prepare a review fixture at a filesystem root or repository root.",
  );
}

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

await mkdir(target, { recursive: false });
await cp(templateRoot, target, { recursive: true });
await writeFile(path.join(target, markerName), markerContent, "utf8");

console.log(`Prepared Glossa plugin review workspace at ${target}`);
