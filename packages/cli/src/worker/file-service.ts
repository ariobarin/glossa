import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_TEXT_BYTES } from "@glossa/protocol";
import { WorkerError } from "./errors.js";
import type { PathPolicy } from "./path-policy.js";

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export interface ReadTextResult {
  content: string;
  sha256: string;
  bytes: number;
}

export interface WriteTextResult {
  sha256: string;
  bytes: number;
}

export class FileService {
  constructor(readonly policy: PathPolicy) {}

  async readText(relativePath: string): Promise<ReadTextResult> {
    const target = await this.policy.resolveExisting(relativePath);
    const targetStat = await stat(target);
    if (!targetStat.isFile()) {
      throw new WorkerError("not_file", "The requested path is not a file.");
    }
    if (targetStat.size > MAX_TEXT_BYTES) {
      throw new WorkerError("file_too_large", "The file exceeds the 1 MiB text limit.");
    }
    const content = await readFile(target);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(content);
    } catch {
      throw new WorkerError("not_text", "The file is not valid UTF-8 text.");
    }
    return { content: text, sha256: sha256(content), bytes: content.byteLength };
  }

  async writeText(
    relativePath: string,
    content: string,
    expectedSha256?: string,
  ): Promise<WriteTextResult> {
    const bytes = Buffer.from(content, "utf8");
    if (bytes.byteLength > MAX_TEXT_BYTES) {
      throw new WorkerError("file_too_large", "The content exceeds the 1 MiB text limit.");
    }

    let target = await this.policy.resolveWritableFile(relativePath);
    if (expectedSha256) {
      let actual: string | null = null;
      try {
        const existing = await readFile(target);
        actual = sha256(existing);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (actual !== expectedSha256) {
        throw new WorkerError("stale_revision", "The file revision has changed.");
      }
    }

    const temporary = path.join(path.dirname(target), `.glossa-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      target = await this.policy.resolveWritableFile(relativePath);
      const tempStat = await lstat(temporary);
      if (!tempStat.isFile() || tempStat.isSymbolicLink()) {
        throw new WorkerError("unsafe_temporary_file", "The atomic write temporary file changed.");
      }
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }

    return { sha256: sha256(bytes), bytes: bytes.byteLength };
  }
}
