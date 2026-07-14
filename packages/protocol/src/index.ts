import { z } from "zod";

export const MAX_TEXT_BYTES = 1024 * 1024;
export const DEFAULT_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
export const MAX_COMMAND_TIMEOUT_MS = 60 * 60 * 1000;
export const MAX_COMMAND_STATUS_WAIT_MS = 15_000;
export const DEFAULT_WORKER_POLL_MS = 15_000;
export const MAX_WORKER_POLL_MS = 20_000;

export const deviceNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\u0000-\u001f\u007f]+$/, "Device name contains control characters");

export const openWorkspaceJobSchema = z.object({
  type: z.literal("open_workspace"),
  requestId: z.string().uuid(),
  path: z.string().max(4096),
});

export const readFileJobSchema = z.object({
  type: z.literal("read_file"),
  requestId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  path: z.string().max(4096),
});

export const writeFileJobSchema = z.object({
  type: z.literal("write_file"),
  requestId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  path: z.string().max(4096),
  content: z.string(),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export const runCommandJobSchema = z
  .object({
    type: z.literal("run_command"),
    requestId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    argv: z.array(z.string()).min(1).max(256).optional(),
    shellCommand: z.string().max(64 * 1024).optional(),
    stdin: z.string().max(MAX_TEXT_BYTES).optional(),
    timeoutMs: z
      .number()
      .int()
      .min(1)
      .max(MAX_COMMAND_TIMEOUT_MS)
      .default(DEFAULT_COMMAND_TIMEOUT_MS),
  })
  .superRefine((value, context) => {
    if ((value.argv ? 1 : 0) + (value.shellCommand ? 1 : 0) !== 1) {
      context.addIssue({
        code: "custom",
        message: "Exactly one of argv or shellCommand is required.",
      });
    }
  });

export const getCommandJobSchema = z.object({
  type: z.literal("get_command"),
  requestId: z.string().uuid(),
  commandId: z.string().uuid(),
  waitMs: z.number().int().min(0).max(MAX_COMMAND_STATUS_WAIT_MS).optional(),
});

export const cancelCommandJobSchema = z.object({
  type: z.literal("cancel_command"),
  requestId: z.string().uuid(),
  commandId: z.string().uuid(),
});

export const closeWorkspaceJobSchema = z.object({
  type: z.literal("close_workspace"),
  requestId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export const workerJobSchema = z.discriminatedUnion("type", [
  openWorkspaceJobSchema,
  readFileJobSchema,
  writeFileJobSchema,
  runCommandJobSchema,
  getCommandJobSchema,
  cancelCommandJobSchema,
  closeWorkspaceJobSchema,
]);

export type WorkerJob = z.infer<typeof workerJobSchema>;

export const workerResultSchema = z.object({
  requestId: z.string().uuid(),
  ok: z.boolean(),
  value: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type WorkerResult = z.infer<typeof workerResultSchema>;
