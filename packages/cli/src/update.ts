import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isStandaloneExecutable } from "./runtime.js";

const NPM_PACKAGE = "@ariobarin/glossa@beta";
const DEFAULT_RELEASES_API =
  "https://api.github.com/repos/ariobarin/glossa/releases?per_page=20";

export interface UpdateInvocation {
  command: string;
  args: string[];
}

export interface UpdateDependencies {
  platform?: NodeJS.Platform;
  architecture?: string;
  environment?: NodeJS.ProcessEnv;
  executablePath?: string;
  currentVersion?: string;
  standalone?: boolean;
  fetch?: typeof fetch;
  run?: (
    command: string,
    args: string[],
    options: { stdio: "inherit" },
  ) => { status: number | null; error?: Error };
  log?: (message: string) => void;
  updateStandalone?: () => Promise<string>;
}

interface ReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface Release {
  draft?: unknown;
  tag_name?: unknown;
  assets?: unknown;
}

export interface StandaloneRelease {
  version: string;
  binaryUrl: string;
  checksumUrl: string;
}

export function npmUpdateInvocation(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): UpdateInvocation {
  if (platform === "win32") {
    return {
      command: environment.ComSpec ?? environment.COMSPEC ?? "cmd.exe",
      args: ["/d", "/s", "/c", `npm install --global ${NPM_PACKAGE}`],
    };
  }
  return {
    command: "npm",
    args: ["install", "--global", NPM_PACKAGE],
  };
}

export function standaloneAssetName(
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): string {
  const operatingSystem =
    platform === "win32"
      ? "windows"
      : platform === "darwin"
        ? "macos"
        : platform === "linux"
          ? "linux"
          : null;
  if (!operatingSystem || !["x64", "arm64"].includes(architecture)) {
    throw new Error(
      `The direct Glossa installer does not support ${platform}/${architecture}. Use npm instead.`,
    );
  }
  return `glossa-${operatingSystem}-${architecture}${platform === "win32" ? ".exe" : ""}`;
}

export function selectStandaloneRelease(
  value: unknown,
  assetName: string,
): StandaloneRelease {
  if (!Array.isArray(value)) {
    throw new Error("The Glossa release service returned an invalid response.");
  }
  for (const candidate of value as Release[]) {
    if (candidate.draft === true || typeof candidate.tag_name !== "string") {
      continue;
    }
    if (!candidate.tag_name.startsWith("cli-v") || !Array.isArray(candidate.assets)) {
      continue;
    }
    const assets = candidate.assets as ReleaseAsset[];
    const binary = assets.find((asset) => asset.name === assetName);
    const checksum = assets.find(
      (asset) => asset.name === `${assetName}.sha256`,
    );
    if (
      typeof binary?.browser_download_url === "string" &&
      typeof checksum?.browser_download_url === "string"
    ) {
      return {
        version: candidate.tag_name.slice("cli-v".length),
        binaryUrl: binary.browser_download_url,
        checksumUrl: checksum.browser_download_url,
      };
    }
  }
  throw new Error(
    `No Glossa direct-install release contains ${assetName}. Use npm or try again after the next release.`,
  );
}

export function expectedChecksum(text: string, assetName: string): string {
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line.trim());
    if (match?.[1] && match[2] === assetName) return match[1].toLowerCase();
  }
  throw new Error(`The checksum file did not contain ${assetName}.`);
}

async function checkedFetch(
  fetcher: typeof fetch,
  url: string,
): Promise<Response> {
  const response = await fetcher(url, {
    headers: { "User-Agent": "glossa-cli" },
  });
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}: ${url}`);
  }
  return response;
}

async function updateStandalone(
  dependencies: UpdateDependencies,
): Promise<string> {
  const platform = dependencies.platform ?? process.platform;
  const architecture = dependencies.architecture ?? process.arch;
  const environment = dependencies.environment ?? process.env;
  const executablePath = dependencies.executablePath ?? process.execPath;
  const fetcher = dependencies.fetch ?? fetch;
  const assetName = standaloneAssetName(platform, architecture);
  const releasesUrl =
    environment.GLOSSA_RELEASES_API ?? DEFAULT_RELEASES_API;
  const releasesResponse = await checkedFetch(fetcher, releasesUrl);
  const release = selectStandaloneRelease(
    await releasesResponse.json(),
    assetName,
  );
  if (release.version === dependencies.currentVersion) {
    return `Glossa ${release.version} is already current.`;
  }

  const [binaryResponse, checksumResponse] = await Promise.all([
    checkedFetch(fetcher, release.binaryUrl),
    checkedFetch(fetcher, release.checksumUrl),
  ]);
  const binary = Buffer.from(await binaryResponse.arrayBuffer());
  const expected = expectedChecksum(await checksumResponse.text(), assetName);
  const actual = createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Glossa refused the update because the SHA-256 checksum did not match.`,
    );
  }

  const downloadPath = `${executablePath}.download-${process.pid}`;
  const backupPath = `${executablePath}.old`;
  writeFileSync(downloadPath, binary, { mode: 0o755 });
  if (platform !== "win32") chmodSync(downloadPath, 0o755);

  try {
    if (platform === "win32") {
      rmSync(backupPath, { force: true });
      renameSync(executablePath, backupPath);
      try {
        renameSync(downloadPath, executablePath);
      } catch (error) {
        renameSync(backupPath, executablePath);
        throw error;
      }
      try {
        rmSync(backupPath, { force: true });
      } catch {
        // Windows may retain the running executable until this process exits.
      }
    } else {
      renameSync(downloadPath, executablePath);
    }
  } finally {
    if (existsSync(downloadPath)) rmSync(downloadPath, { force: true });
  }
  return `Updated Glossa to ${release.version}.`;
}

export async function updateGlossa(
  dependencies: UpdateDependencies = {},
): Promise<void> {
  const log = dependencies.log ?? console.log;
  const standalone =
    dependencies.standalone ?? isStandaloneExecutable();
  if (standalone) {
    log("Updating the standalone Glossa executable...");
    const message = dependencies.updateStandalone
      ? await dependencies.updateStandalone()
      : await updateStandalone(dependencies);
    log(message);
    return;
  }

  const run = dependencies.run ?? spawnSync;
  const invocation = npmUpdateInvocation(
    dependencies.platform,
    dependencies.environment,
  );
  log("Updating Glossa from the npm beta channel...");
  const result = run(invocation.command, invocation.args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`Glossa could not start npm: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `npm could not update Glossa (exit ${result.status ?? "unknown"}).`,
    );
  }
  log("Glossa updated.");
  log("Next: run glossa to reopen this workspace.");
  log("Inside Glossa, press ? for controls.");
}
