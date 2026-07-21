import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const KEYRING_SERVICE = "Glossa";

interface KeyringEntry {
  setPassword(password: string): Promise<void>;
  getPassword(): Promise<string | null | undefined>;
  deleteCredential(): Promise<boolean>;
}

export type StorageBackend = "keyring" | "file";

export interface SecureStoreOptions<T> {
  account: string;
  file: string;
  warning: string;
  parse: (serialized: string) => T;
  warn?: (message: string) => void;
  entryProvider?: () => Promise<KeyringEntry | null>;
}

export function configDirectory(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), "Glossa");
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    "glossa",
  );
}

export class SecureStore<T> {
  readonly #options: SecureStoreOptions<T>;

  constructor(options: SecureStoreOptions<T>) {
    this.#options = options;
  }

  async save(value: T): Promise<StorageBackend> {
    const serialized = JSON.stringify(value);
    const entry = await this.#entry();
    if (entry) {
      try {
        await entry.setPassword(serialized);
        await rm(this.#options.file, { force: true });
        return "keyring";
      } catch {
        // Use the warned file fallback below.
      }
    }

    this.#warn();
    await mkdir(path.dirname(this.#options.file), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(
      this.#options.file,
      `${JSON.stringify(value, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    if (process.platform !== "win32") {
      await chmod(this.#options.file, 0o600);
    }
    return "file";
  }

  async load(): Promise<{ value: T; backend: StorageBackend } | null> {
    const entry = await this.#entry();
    if (entry) {
      let serialized: string | null | undefined;
      try {
        serialized = await entry.getPassword();
      } catch {
        // An existing file can still provide the warned fallback.
      }
      if (serialized != null) {
        try {
          return { value: this.#options.parse(serialized), backend: "keyring" };
        } catch {
          // The keyring returned a value that doesn't parse as valid
          // credentials (e.g. some backends return the string "null"
          // instead of undefined when no entry exists). Treat it as
          // absent rather than crashing, and clear the bad entry.
          try {
            await entry.deleteCredential();
          } catch {
            // Best effort cleanup of a corrupt keyring entry.
          }
        }
      }
    }

    let value: T;
    try {
      value = this.#options.parse(await readFile(this.#options.file, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }

    if (entry) {
      try {
        await entry.setPassword(JSON.stringify(value));
        await rm(this.#options.file, { force: true });
        return { value, backend: "keyring" };
      } catch {
        // Keep the existing file and use the warned fallback below.
      }
    }

    this.#warn();
    return { value, backend: "file" };
  }

  async delete(): Promise<void> {
    const entry = await this.#entry();
    let keyringDeleteFailed = false;
    if (entry) {
      try {
        const deleted = await entry.deleteCredential();
        if (!deleted && (await entry.getPassword()) != null) {
          keyringDeleteFailed = true;
        }
      } catch {
        keyringDeleteFailed = true;
      }
    }
    await rm(this.#options.file, { force: true });
    if (keyringDeleteFailed) {
      throw new Error(
        "The operating-system credential store could not remove the Glossa credential.",
      );
    }
  }

  async #entry(): Promise<KeyringEntry | null> {
    if (this.#options.entryProvider) {
      try {
        return await this.#options.entryProvider();
      } catch {
        return null;
      }
    }
    try {
      const { AsyncEntry } = await import("@napi-rs/keyring");
      return new AsyncEntry(KEYRING_SERVICE, this.#options.account);
    } catch {
      return null;
    }
  }

  #warn(): void {
    (this.#options.warn ?? console.warn)(this.#options.warning);
  }
}
