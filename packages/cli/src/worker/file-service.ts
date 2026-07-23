import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { MAX_EDIT_DIFF_BYTES, MAX_TEXT_BYTES } from "@glossa/protocol";
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

export interface EditTextOperation {
  oldText: string;
  newText: string;
}

export interface EditTextResult extends WriteTextResult {
  replacements: number;
  diff: string;
  diffTruncated: boolean;
}

interface LocatedEdit extends EditTextOperation {
  start: number;
  end: number;
}

interface DiffHunk {
  oldStart: number;
  oldEnd: number;
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function lineStart(content: string, index: number): number {
  return content.lastIndexOf("\n", index - 1) + 1;
}

function lineEnd(content: string, start: number, end: number): number {
  const changedIndex = Math.max(start, end - 1);
  const newline = content.indexOf("\n", changedIndex);
  return newline === -1 ? content.length : newline + 1;
}

function diffLines(content: string): string[] {
  if (content.length === 0) return [];
  const normalized = content.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  return lines;
}

function mappedIndex(index: number, edits: LocatedEdit[]): number {
  let delta = 0;
  for (const edit of edits) {
    if (edit.end > index) break;
    delta += edit.newText.length - (edit.end - edit.start);
  }
  return index + delta;
}

function createUnifiedDiff(
  relativePath: string,
  original: string,
  updated: string,
  edits: LocatedEdit[],
): string {
  const hunks: DiffHunk[] = [];
  for (const edit of edits) {
    const candidate = {
      oldStart: lineStart(original, edit.start),
      oldEnd: lineEnd(original, edit.start, edit.end),
    };
    const previous = hunks.at(-1);
    if (previous && candidate.oldStart <= previous.oldEnd) {
      previous.oldEnd = Math.max(previous.oldEnd, candidate.oldEnd);
    } else {
      hunks.push(candidate);
    }
  }

  const displayPath = relativePath.replaceAll("\\", "/");
  const lines = [`--- a/${displayPath}`, `+++ b/${displayPath}`];
  for (const hunk of hunks) {
    const newStart = mappedIndex(hunk.oldStart, edits);
    const newEnd = mappedIndex(hunk.oldEnd, edits);
    const oldLines = diffLines(original.slice(hunk.oldStart, hunk.oldEnd));
    const newLines = diffLines(updated.slice(newStart, newEnd));
    lines.push(
      `@@ -${lineNumberAt(original, hunk.oldStart)},${oldLines.length} +${lineNumberAt(updated, newStart)},${newLines.length} @@`,
      ...oldLines.map((line) => `-${line}`),
      ...newLines.map((line) => `+${line}`),
    );
  }
  return `${lines.join("\n")}\n`;
}

function boundDiff(diff: string): { diff: string; truncated: boolean } {
  const encoded = Buffer.from(diff, "utf8");
  if (encoded.byteLength <= MAX_EDIT_DIFF_BYTES) {
    return { diff, truncated: false };
  }
  const marker = "\n... diff truncated by Glossa ...\n";
  const available = Math.max(
    0,
    MAX_EDIT_DIFF_BYTES - Buffer.byteLength(marker, "utf8"),
  );
  const prefix = new StringDecoder("utf8").write(encoded.subarray(0, available));
  return { diff: `${prefix}${marker}`, truncated: true };
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

  async editText(
    relativePath: string,
    edits: EditTextOperation[],
    expectedSha256?: string,
  ): Promise<EditTextResult> {
    const original = await this.readText(relativePath);
    if (expectedSha256 && original.sha256 !== expectedSha256) {
      throw new WorkerError("stale_revision", "The file revision has changed.");
    }

    const located = edits
      .map((edit): LocatedEdit => {
        const start = original.content.indexOf(edit.oldText);
        if (start === -1) {
          throw new WorkerError("edit_not_found", "The edit target was not found.");
        }
        if (original.content.indexOf(edit.oldText, start + 1) !== -1) {
          throw new WorkerError(
            "edit_ambiguous",
            "The edit target occurs more than once.",
          );
        }
        return { ...edit, start, end: start + edit.oldText.length };
      })
      .sort((left, right) => left.start - right.start);

    for (let index = 1; index < located.length; index += 1) {
      if (located[index]!.start < located[index - 1]!.end) {
        throw new WorkerError("edit_overlap", "The requested edits overlap.");
      }
    }

    let cursor = 0;
    let updated = "";
    for (const edit of located) {
      updated += original.content.slice(cursor, edit.start);
      updated += edit.newText;
      cursor = edit.end;
    }
    updated += original.content.slice(cursor);

    const rendered = boundDiff(
      createUnifiedDiff(relativePath, original.content, updated, located),
    );
    const written = await this.writeText(relativePath, updated, original.sha256);
    return {
      ...written,
      replacements: located.length,
      diff: rendered.diff,
      diffTruncated: rendered.truncated,
    };
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
