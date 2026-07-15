import { z } from "zod";

export const MAX_TEXT_BYTES = 1024 * 1024;
export const DEFAULT_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
export const MAX_COMMAND_TIMEOUT_MS = 60 * 60 * 1000;
export const MAX_COMMAND_STATUS_WAIT_MS = 15_000;
export const DEFAULT_WORKER_POLL_MS = 15_000;
export const MAX_WORKER_POLL_MS = 18_000;

export const deviceNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\u0000-\u001f\u007f]+$/, "Device name contains control characters");

export const relativePathSchema = z.string().max(4096);
const boundedTextSchema = z
  .string()
  .refine((value) => Buffer.byteLength(value, "utf8") <= MAX_TEXT_BYTES);

export const readFileRequestSchema = z.object({
  path: relativePathSchema,
}).strict();

export const readFileJobSchema = readFileRequestSchema.extend({
  type: z.literal("read_file"),
  requestId: z.string().uuid(),
});

export const writeFileRequestSchema = z.object({
  path: relativePathSchema,
  content: boundedTextSchema,
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

export const writeFileJobSchema = writeFileRequestSchema.extend({
  type: z.literal("write_file"),
  requestId: z.string().uuid(),
});

function requireOneCommand(
  value: {
    argv?: string[] | undefined;
    shellCommand?: string | undefined;
  },
  context: z.core.$RefinementCtx,
): void {
  if ((value.argv ? 1 : 0) + (value.shellCommand ? 1 : 0) !== 1) {
    context.addIssue({
      code: "custom",
      message: "Exactly one of argv or shellCommand is required.",
      input: value,
    });
  }
}

export const runCommandRequestSchema = z
  .object({
    argv: z.array(z.string()).min(1).max(256).optional(),
    shellCommand: z.string().max(64 * 1024).optional(),
    stdin: boundedTextSchema.optional(),
    timeoutMs: z
      .number()
      .int()
      .min(1)
      .max(MAX_COMMAND_TIMEOUT_MS)
      .default(DEFAULT_COMMAND_TIMEOUT_MS),
  })
  .strict()
  .superRefine(requireOneCommand);

export const runCommandJobSchema = runCommandRequestSchema.safeExtend({
  type: z.literal("run_command"),
  requestId: z.string().uuid(),
});

export const getCommandRequestSchema = z.object({
  commandId: z.string().uuid(),
  waitMs: z.number().int().min(0).max(MAX_COMMAND_STATUS_WAIT_MS).optional(),
}).strict();

export const getCommandJobSchema = getCommandRequestSchema.extend({
  type: z.literal("get_command"),
  requestId: z.string().uuid(),
});

export const cancelCommandRequestSchema = z.object({
  commandId: z.string().uuid(),
}).strict();

export const cancelCommandJobSchema = cancelCommandRequestSchema.extend({
  type: z.literal("cancel_command"),
  requestId: z.string().uuid(),
});

export const workerJobSchema = z.discriminatedUnion("type", [
  readFileJobSchema,
  writeFileJobSchema,
  runCommandJobSchema,
  getCommandJobSchema,
  cancelCommandJobSchema,
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
