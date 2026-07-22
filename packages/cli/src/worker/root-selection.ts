import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorkerError } from "./errors.js";
import { canonicalizeRoot } from "./path-policy.js";

const execFileAsync = promisify(execFile);

async function gitWorktreeRoot(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    });
    const root = stdout.trim();
    return root || null;
  } catch {
    return null;
  }
}

export async function selectExposureRoot(
  explicitPath: string | undefined,
  allowBroadRoot = false,
  cwd = process.cwd(),
): Promise<string> {
  const selected = explicitPath ?? (await gitWorktreeRoot(cwd));
  if (!selected) {
    throw new WorkerError(
      "root_required",
      `No Git worktree was found in ${cwd}. Run "glossa start ." to expose the current folder, or "glossa start <path>" to expose another directory.`,
    );
  }
  return await canonicalizeRoot(selected, allowBroadRoot);
}
