import readline from "node:readline";
import { workerJobSchema } from "@glossa/protocol";
import { LocalWorker } from "./local-worker.js";

const visibleActivity = new Set(["write_file", "run_command", "cancel_command"]);

export async function runLocalSession(root: string, allowBroadRoot = false): Promise<void> {
  const worker = await LocalWorker.create(root, allowBroadRoot);
  console.error(`Glossa local worker root: ${worker.policy.root}`);
  console.error(
    "Commands have the full environment and permissions of this account. Press Ctrl+C to disconnect.",
  );

  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const stop = (): void => lines.close();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const job = workerJobSchema.parse(JSON.parse(line));
        if (visibleActivity.has(job.type)) {
          console.error(`Activity started: ${job.type} (${job.requestId})`);
        }
        const result = await worker.handle(job);
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (visibleActivity.has(job.type)) {
          console.error(
            `Activity finished: ${job.type} (${job.requestId}), ${result.ok ? "accepted" : "rejected"}`,
          );
        }
      } catch {
        process.stdout.write(
          `${JSON.stringify({ ok: false, error: { code: "invalid_job", message: "Invalid worker job." } })}\n`,
        );
      }
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await worker.shutdown();
  }
}
