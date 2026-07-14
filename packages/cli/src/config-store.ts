import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const KEYRING_SERVICE = "Glossa";
const KEYRING_ACCOUNT = "oauth";

export const FILE_CREDENTIAL_WARNING =
  "Warning: the operating-system credential store is unavailable. Glossa is using a mode-0600 credential file.";

export interface StoredCredentials {
  issuer: string;
  clientId: string;
  audience: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
  scope?: string;
}

export type CredentialBackend = "keyring" | "file";

export interface LoadedCredentials {
  credentials: StoredCredentials;
  backend: CredentialBackend;
}

interface KeyringEntry {
  setPassword(password: string): Promise<void>;
  getPassword(): Promise<string | undefined>;
  deleteCredential(): Promise<boolean>;
}

type EntryProvider = () => Promise<KeyringEntry | null>;

export interface CredentialStoreOptions {
  credentialsFile?: string;
  entryProvider?: EntryProvider;
  warn?: (message: string) => void;
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

async function defaultEntryProvider(): Promise<KeyringEntry | null> {
  try {
    const { AsyncEntry } = await import("@napi-rs/keyring");
    return new AsyncEntry(KEYRING_SERVICE, KEYRING_ACCOUNT);
  } catch {
    return null;
  }
}

function parseCredentials(value: string): StoredCredentials {
  let parsed: Partial<StoredCredentials>;
  try {
    parsed = JSON.parse(value) as Partial<StoredCredentials>;
  } catch {
    throw new Error("Stored Glossa credentials are invalid.");
  }
  if (
    typeof parsed.issuer !== "string" ||
    typeof parsed.clientId !== "string" ||
    typeof parsed.audience !== "string" ||
    typeof parsed.accessToken !== "string" ||
    typeof parsed.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.expiresAt)) ||
    typeof parsed.tokenType !== "string" ||
    (parsed.refreshToken !== undefined && typeof parsed.refreshToken !== "string") ||
    (parsed.scope !== undefined && typeof parsed.scope !== "string")
  ) {
    throw new Error("Stored Glossa credentials are invalid.");
  }
  return parsed as StoredCredentials;
}

async function readFileCredentials(target: string): Promise<StoredCredentials | null> {
  try {
    return parseCredentials(await readFile(target, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

async function writeFileCredentials(
  target: string,
  credentials: StoredCredentials,
): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  if (process.platform !== "win32") await chmod(target, 0o600);
}

export class CredentialStore {
  readonly #credentialsFile: string;
  readonly #entryProvider: EntryProvider;
  readonly #warn: (message: string) => void;

  constructor(options: CredentialStoreOptions = {}) {
    this.#credentialsFile = options.credentialsFile ?? credentialsPath();
    this.#entryProvider = options.entryProvider ?? defaultEntryProvider;
    this.#warn = options.warn ?? console.warn;
  }

  async #entry(): Promise<KeyringEntry | null> {
    try {
      return await this.#entryProvider();
    } catch {
      return null;
    }
  }

  async save(credentials: StoredCredentials): Promise<CredentialBackend> {
    const serialized = JSON.stringify(credentials);
    const entry = await this.#entry();
    if (entry) {
      try {
        await entry.setPassword(serialized);
        await rm(this.#credentialsFile, { force: true });
        return "keyring";
      } catch {
        // Fall through to the explicitly warned file backend.
      }
    }

    this.#warn(FILE_CREDENTIAL_WARNING);
    await writeFileCredentials(this.#credentialsFile, credentials);
    return "file";
  }

  async load(): Promise<LoadedCredentials | null> {
    const entry = await this.#entry();
    if (entry) {
      let serialized: string | undefined;
      try {
        serialized = await entry.getPassword();
      } catch {
        // A legacy file can still provide an explicitly warned fallback.
      }
      if (serialized) {
        return { credentials: parseCredentials(serialized), backend: "keyring" };
      }
    }

    const credentials = await readFileCredentials(this.#credentialsFile);
    if (!credentials) return null;

    if (entry) {
      try {
        await entry.setPassword(JSON.stringify(credentials));
        await rm(this.#credentialsFile, { force: true });
        return { credentials, backend: "keyring" };
      } catch {
        // Keep using the existing file and warn below.
      }
    }

    this.#warn(FILE_CREDENTIAL_WARNING);
    return { credentials, backend: "file" };
  }

  async delete(): Promise<void> {
    const entry = await this.#entry();
    if (entry) {
      try {
        await entry.deleteCredential();
      } catch {
        // Deleting a missing or unavailable keyring entry is idempotent.
      }
    }
    await rm(this.#credentialsFile, { force: true });
  }
}

const defaultStore = new CredentialStore();

export async function saveCredentials(
  credentials: StoredCredentials,
): Promise<CredentialBackend> {
  return await defaultStore.save(credentials);
}

export async function loadCredentials(): Promise<LoadedCredentials | null> {
  return await defaultStore.load();
}

export async function deleteCredentials(): Promise<void> {
  await defaultStore.delete();
}
