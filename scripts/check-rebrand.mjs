import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const roots = ["apps", "packages"];
const forbidden = [/\bVeronica\b/g, /\bveronica\b/g, /VERONICA_/g];
const failures = [];

async function walk(current) {
  for (const name of await readdir(current)) {
    const full = path.join(current, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      await walk(full);
      continue;
    }
    if (!/\.(ts|js|json|md)$/.test(name)) continue;
    const text = await readFile(full, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text)) failures.push(`${full}: ${pattern}`);
      pattern.lastIndex = 0;
    }
  }
}

for (const root of roots) await walk(root);

if (failures.length) {
  console.error("Legacy naming found in runtime/package files:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime/package rebrand check passed.");
