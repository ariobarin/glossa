import { constants } from "node:fs";
import { access, copyFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error("Run this setup through npm run dev:setup");
  process.exit(1);
}

try {
  await access(envPath, constants.F_OK);
} catch {
  await copyFile(resolve(root, ".env.example"), envPath);
  console.log("Created .env from .env.example");
}

const envFile = await readFile(envPath, "utf8");
const databaseUrl = envFile
  .split(/\r?\n/u)
  .find((line) => line.startsWith("DATABASE_URL="))
  ?.slice("DATABASE_URL=".length)
  .replace(/^['"]|['"]$/gu, "");

if (!databaseUrl) {
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}

const database = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.port !== "55432"
) {
  console.error("dev:setup only migrates local Postgres on port 55432");
  process.exit(1);
}

run("docker", ["compose", "up", "-d", "--wait", "postgres"]);
run(process.execPath, [npmCli, "run", "build", "--workspace", "@glossa/protocol"]);
run(process.execPath, [npmCli, "run", "build", "--workspace", "@glossa/relay"]);
run(process.execPath, [npmCli, "run", "migrate", "--workspace", "@glossa/relay"]);

console.log("Local Glossa dependencies are ready. Run npm run dev.");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
