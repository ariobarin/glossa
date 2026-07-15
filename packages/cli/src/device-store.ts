import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { configDirectory } from "./config-store.js";

const KEYRING_SERVICE = "Glossa";
const KEYRING_ACCOUNT = "device";

export const FILE_DEVICE_WARNING =
  "Warning: the operating-system credential store is unavailable. Glossa is using a mode-0600 device credential file.";

export interface StoredDeviceCredential {
  relayOrigin: string;
  deviceId: string;
  deviceName: string;
  token: string;
}

interface KeyringEntry {
  setPassword(password: string): Promise<void>;
  getPassword(): Promise<string | undefined>;
  deleteCredential(): Promise<boolean>;
}

type EntryProvider = () => Promise<KeyringEntry | null>;

export interface DeviceStoreOptions {
  credentialFile?: string;
  entryProvider?: EntryProvider;
  warn?: (message: string) => void;
}

export function deviceCredentialPath(): string {
  return path.join(configDirectory(), "device.json");
}

async function defaultEntryProvider(): Promise<KeyringEntry | null> {
  try {
    const { AsyncEntry } = await import("@napi-rs/keyring");
    return new AsyncEntry(KEYRING_SERVICE, KEYRING_ACCOUNT);
  } catch {
    return null;
  }
}

function parseDeviceCredential(value: string): StoredDeviceCredential {
  let parsed: Partial<StoredDeviceCredential>;
  try {
    parsed = JSON.parse(value) as Partial<StoredDeviceCredential>;
  } catch {
    throw new Error("Stored Glossa device credentials are invalid.");
  }
  let relayOriginValid = false;
  if (typeof parsed.relayOrigin === "string") {
    try {
      relayOriginValid = new URL(parsed.relayOrigin).origin === parsed.relayOrigin;
    } catch {
      relayOriginValid = false;
    }
  }
  if (
    !relayOriginValid ||
    typeof parsed.deviceId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      parsed.deviceId,
    ) ||
    typeof parsed.deviceName !== "string" ||
    parsed.deviceName.length === 0 ||
    typeof parsed.token !== "string" ||
    !parsed.token.startsWith(`gld_${parsed.deviceId}_`)
  ) {
    throw new Error("Stored Glossa device credentials are invalid.");
  }
  return parsed as StoredDeviceCredential;
}

async function readFileCredential(
  target: string,
): Promise<StoredDeviceCredential | null> {
  try {
    return parseDeviceCredential(await readFile(target, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeFileCredential(
  target: string,
  credential: StoredDeviceCredential,
): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, `${JSON.stringify(credential, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  if (process.platform !== "win32") await chmod(target, 0o600);
}

export class DeviceStore {
  readonly #credentialFile: string;
  readonly #entryProvider: EntryProvider;
  readonly #warn: (message: string) => void;

  constructor(options: DeviceStoreOptions = {}) {
    this.#credentialFile = options.credentialFile ?? deviceCredentialPath();
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

  async save(credential: StoredDeviceCredential): Promise<void> {
    const entry = await this.#entry();
    if (entry) {
      try {
        await entry.setPassword(JSON.stringify(credential));
        await rm(this.#credentialFile, { force: true });
        return;
      } catch {
        // Fall through to the explicitly warned file backend.
      }
    }
    this.#warn(FILE_DEVICE_WARNING);
    await writeFileCredential(this.#credentialFile, credential);
  }

  async load(): Promise<StoredDeviceCredential | null> {
    const entry = await this.#entry();
    if (entry) {
      try {
        const value = await entry.getPassword();
        if (value) return parseDeviceCredential(value);
      } catch {
        // An existing file can still provide the warned fallback.
      }
    }

    const credential = await readFileCredential(this.#credentialFile);
    if (!credential) return null;
    if (entry) {
      try {
        await entry.setPassword(JSON.stringify(credential));
        await rm(this.#credentialFile, { force: true });
        return credential;
      } catch {
        // Keep the credential file and warn below.
      }
    }
    this.#warn(FILE_DEVICE_WARNING);
    return credential;
  }

  async delete(): Promise<void> {
    const entry = await this.#entry();
    if (entry) {
      try {
        await entry.deleteCredential();
      } catch {
        // Deleting an unavailable keyring entry is idempotent.
      }
    }
    await rm(this.#credentialFile, { force: true });
  }
}

const defaultStore = new DeviceStore();

export async function loadDeviceCredential(): Promise<StoredDeviceCredential | null> {
  return await defaultStore.load();
}

export async function saveDeviceCredential(
  credential: StoredDeviceCredential,
): Promise<void> {
  await defaultStore.save(credential);
}

export async function deleteDeviceCredential(): Promise<void> {
  await defaultStore.delete();
}
