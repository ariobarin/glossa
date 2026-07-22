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

async function rootRequiredMessage(cwd: string): Promise<string> {
  try {
    await canonicalizeRoot(cwd, false);
    return `No Git worktree was found in ${cwd}. Run "glossa start ." to expose the current folder, or "glossa start <path>" to expose another directory.`;
  } catch (error) {
    if (error instanceof WorkerError && error.code === "broad_root_refused") {
      return `No Git worktree was found in ${cwd}, and this protected root is too broad to expose by default. Run "glossa start <path>" with a project directory, or "glossa start . --allow-broad-root" to expose the current folder anyway.`;
    }
    throw error;
  }
}

export async function selectExposureRoot(
  explicitPath: string | undefined,
  allowBroadRoot = false,
  cwd = process.cwd(),
): Promise<string> {
  const selected = explicitPath ?? (await gitWorktreeRoot(cwd));
  if (!selected) {
    throw new WorkerError("root_required", await rootRequiredMessage(cwd));
  }
  return await canonicalizeRoot(selected, allowBroadRoot);
}
