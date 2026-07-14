import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface StoredCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
  scope?: string;
}

function configDirectory(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), "Glossa");
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "glossa");
}

export function credentialsPath(): string {
  return path.join(configDirectory(), "credentials.json");
}

export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  const directory = configDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = credentialsPath();
  await writeFile(target, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  if (process.platform !== "win32") await chmod(target, 0o600);
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    return JSON.parse(await readFile(credentialsPath(), "utf8")) as StoredCredentials;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteCredentials(): Promise<void> {
  await rm(credentialsPath(), { force: true });
}
