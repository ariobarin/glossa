import type { WorkerJob, WorkerResult } from "@glossa/protocol";
import { CommandService } from "./command-service.js";
import { WorkerError } from "./errors.js";
import { FileService } from "./file-service.js";
import { PathPolicy } from "./path-policy.js";
import { WorkspaceManager } from "./workspace-manager.js";

export class LocalWorker {
  private constructor(
    readonly policy: PathPolicy,
    readonly workspaces: WorkspaceManager,
    readonly files: FileService,
    readonly commands: CommandService,
  ) {}

  static async create(root: string, allowBroadRoot = false): Promise<LocalWorker> {
    const policy = await PathPolicy.create(root, allowBroadRoot);
    const workspaces = new WorkspaceManager(policy);
    return new LocalWorker(
      policy,
      workspaces,
      new FileService(policy, workspaces),
      new CommandService(workspaces),
    );
  }

  async handle(job: WorkerJob): Promise<WorkerResult> {
    try {
      let value: unknown;
      switch (job.type) {
        case "open_workspace":
          value = await this.workspaces.open(job.path);
          break;
        case "read_file":
          value = await this.files.readText(job.workspaceId, job.path);
          break;
        case "write_file":
          value = await this.files.writeText(
            job.workspaceId,
            job.path,
            job.content,
            job.expectedSha256,
          );
          break;
        case "run_command":
          value = await this.commands.start({
            workspaceId: job.workspaceId,
            ...(job.argv ? { argv: job.argv } : {}),
            ...(job.shellCommand ? { shellCommand: job.shellCommand } : {}),
            ...(job.stdin !== undefined ? { stdin: job.stdin } : {}),
            timeoutMs: job.timeoutMs,
          });
          break;
        case "get_command":
          value = await this.commands.get(job.commandId, job.waitMs);
          break;
        case "cancel_command":
          value = await this.commands.cancel(job.commandId);
          break;
        case "close_workspace":
          value = { closed: this.workspaces.close(job.workspaceId) };
          break;
      }
      return { requestId: job.requestId, ok: true, value };
    } catch (error) {
      const workerError =
        error instanceof WorkerError
          ? error
          : new WorkerError("worker_failure", "The local worker operation failed.");
      return {
        requestId: job.requestId,
        ok: false,
        error: { code: workerError.code, message: workerError.message },
      };
    }
  }

  async shutdown(): Promise<void> {
    await this.commands.shutdown();
  }
}
