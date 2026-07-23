import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const currentExecutable = resolve(process.argv[2] ?? "");
const updateExecutable = resolve(process.argv[3] ?? "");
const assetName = process.argv[4];
if (!process.argv[2] || !process.argv[3] || !assetName) {
  throw new Error("Pass current executable, update executable, and asset name.");
}

const updateBinary = await readFile(updateExecutable);
const hash = createHash("sha256").update(updateBinary).digest("hex");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "glossa-update-"));
const installed = join(
  temporaryDirectory,
  process.platform === "win32" ? "glossa.exe" : "glossa",
);
await copyFile(currentExecutable, installed);
if (process.platform !== "win32") await chmod(installed, 0o755);

const server = createServer((request, response) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (request.url === "/releases") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify([{
      draft: false,
      tag_name: "cli-v0.1.0-beta.999",
      assets: [
        { name: assetName, browser_download_url: `${origin}/${assetName}` },
        {
          name: `${assetName}.sha256`,
          browser_download_url: `${origin}/${assetName}.sha256`,
        },
      ],
    }]));
  } else if (request.url === `/${assetName}`) {
    response.end(updateBinary);
  } else if (request.url === `/${assetName}.sha256`) {
    response.end(`${hash}  ${assetName}\n`);
  } else {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));

function run(args, environment = process.env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(installed, args, {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolveRun({ status, stdout, stderr }));
  });
}

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const updated = await run(["update"], {
    ...process.env,
    GLOSSA_RELEASES_API: `http://127.0.0.1:${address.port}/releases`,
  });
  assert.equal(updated.status, 0, `${updated.stdout}\n${updated.stderr}`);
  assert.match(updated.stdout, /Updated Glossa to 0\.1\.0-beta\.999/);
  const version = await run(["--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "0.1.0-beta.999");
  console.log(`Standalone update smoke passed for ${assetName}.`);
} finally {
  server.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
