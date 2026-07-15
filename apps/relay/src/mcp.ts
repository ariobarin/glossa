import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import {
  cancelCommandRequestSchema,
  getCommandRequestSchema,
  readFileRequestSchema,
  runCommandRequestSchema,
  writeFileRequestSchema,
  type WorkerJob,
  type WorkerResult,
} from "@glossa/protocol";
import type { RelayConfig } from "./config.js";
import type { RouterState } from "./router-state.js";

const deviceIdSchema = z.object({ deviceId: z.string().uuid() }).strict();
const readFileInputSchema = readFileRequestSchema.extend(deviceIdSchema.shape);
const writeFileInputSchema = writeFileRequestSchema.extend(deviceIdSchema.shape);
const runCommandInputSchema = runCommandRequestSchema.safeExtend(
  deviceIdSchema.shape,
);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const listDevicesOutputSchema = z
  .object({
    devices: z.array(
      z
        .object({
          deviceId: z.string().uuid(),
          path: z.literal("."),
        })
        .strict(),
    ),
  })
  .strict();
const readFileOutputSchema = z
  .object({
    content: z.string(),
    sha256: sha256Schema,
    bytes: z.number().int().nonnegative(),
  })
  .strict();
const writeFileOutputSchema = z
  .object({
    sha256: sha256Schema,
    bytes: z.number().int().nonnegative(),
  })
  .strict();
const commandOutputSchema = z
  .object({
    commandId: z.string().uuid(),
    status: z.enum(["running", "succeeded", "failed", "canceled", "timed_out"]),
    exitCode: z.number().int().nullable().optional(),
    signal: z.string().nullable().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    stdoutTruncated: z.boolean().optional(),
    stderrTruncated: z.boolean().optional(),
  })
  .strip();

export const MCP_SERVER_VERSION = "0.1.0-beta.3";

const safeWorkerMessages: Record<string, string> = {
  path_not_found: "The requested path does not exist.",
  path_escape: "The requested path escapes the exposed root.",
  not_directory: "The requested path is not a directory.",
  not_file: "The requested path is not a file.",
  file_too_large: "The request exceeds the text size limit.",
  not_text: "The file is not valid UTF-8 text.",
  stale_revision: "The file revision has changed.",
  command_busy: "Another command is already running on this device.",
  invalid_command: "The command request is invalid.",
  invalid_timeout: "The command timeout is invalid.",
  invalid_wait: "The command status wait is invalid.",
  command_not_found: "The command was not found.",
  command_spawn_failed: "The command could not be started.",
  worker_failure: "The local worker operation failed.",
};

function structuredResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function errorResult(code: string, message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: { code, message } }),
      },
    ],
    isError: true,
  };
}

function routedError(error: unknown) {
  const code = error instanceof Error ? error.message : "relay_failure";
  if (code === "device_offline") {
    return errorResult(code, "The device is offline.");
  }
  if (code === "job_timeout") {
    return errorResult(code, "The worker did not respond in time.");
  }
  return errorResult("relay_failure", "The relay operation failed.");
}

function workerError(result: WorkerResult) {
  const code = result.error?.code ?? "worker_failure";
  return errorResult(
    code,
    safeWorkerMessages[code] ?? "The local worker operation failed.",
  );
}

function workerSuccess<T extends z.ZodObject>(
  result: WorkerResult,
  schema: T,
) {
  if (!result.ok) return workerError(result);
  const parsed = schema.safeParse(result.value);
  if (!parsed.success) {
    return errorResult(
      "invalid_worker_result",
      "The worker returned an invalid result.",
    );
  }
  return structuredResult(parsed.data);
}

async function executeJob(
  state: RouterState,
  config: RelayConfig,
  accountId: string,
  deviceId: string,
  job: WorkerJob,
): Promise<WorkerResult> {
  return await state.enqueue(
    accountId,
    deviceId,
    job,
    config.GLOSSA_RELAY_REQUEST_TIMEOUT_MS,
  );
}

function registerTools(
  server: McpServer,
  config: RelayConfig,
  state: RouterState,
  accountId: string,
): void {
  const toolMetadata = {
    securitySchemes: [
      {
        type: "oauth2",
        scopes: [config.GLOSSA_MCP_REQUIRED_SCOPE],
      },
    ],
    ui: { visibility: ["model"] },
    "openai/visibility": "public",
  };

  server.registerTool(
    "list_devices",
    {
      title: "List Devices",
      description: "List the online Glossa workers available to this account.",
      inputSchema: z.object({}).strict(),
      outputSchema: listDevicesOutputSchema,
      _meta: toolMetadata,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => structuredResult({ devices: state.listDevices(accountId) }),
  );

  server.registerTool(
    "read_file",
    {
      title: "Read File",
      description: "Read one UTF-8 text file by relative path from a worker's exposed root.",
      inputSchema: readFileInputSchema,
      outputSchema: readFileOutputSchema,
      _meta: toolMetadata,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ deviceId, path }) => {
      try {
        const result = await executeJob(state, config, accountId, deviceId, {
          type: "read_file",
          requestId: randomUUID(),
          path,
        });
        return workerSuccess(result, readFileOutputSchema);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "write_file",
    {
      title: "Write File",
      description: "Create or replace one UTF-8 text file atomically within a worker's exposed root. Use expectedSha256 to prevent a stale overwrite.",
      inputSchema: writeFileInputSchema,
      outputSchema: writeFileOutputSchema,
      _meta: toolMetadata,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ deviceId, path, content, expectedSha256 }) => {
      const job: WorkerJob = {
        type: "write_file",
        requestId: randomUUID(),
        path,
        content,
        ...(expectedSha256 ? { expectedSha256 } : {}),
      };
      try {
        const result = await executeJob(
          state,
          config,
          accountId,
          deviceId,
          job,
        );
        return workerSuccess(result, writeFileOutputSchema);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "run_command",
    {
      title: "Run Command",
      description: "Start an arbitrary bounded command in the exposed root with the full authority, inherited environment, and network access of the worker account. The command may modify local or external systems.",
      inputSchema: runCommandInputSchema,
      outputSchema: commandOutputSchema,
      _meta: toolMetadata,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ deviceId, argv, shellCommand, stdin, timeoutMs }) => {
      const job: WorkerJob = {
        type: "run_command",
        requestId: randomUUID(),
        ...(argv ? { argv } : {}),
        ...(shellCommand ? { shellCommand } : {}),
        ...(stdin !== undefined ? { stdin } : {}),
        timeoutMs,
      };
      try {
        const result = await executeJob(
          state,
          config,
          accountId,
          deviceId,
          job,
        );
        if (!result.ok) return workerError(result);
        const parsed = commandOutputSchema.safeParse(result.value);
        if (!parsed.success) {
          return errorResult(
            "invalid_worker_result",
            "The worker returned an invalid result.",
          );
        }
        state.rememberCommand(accountId, deviceId, parsed.data.commandId);
        return structuredResult(parsed.data);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "get_command",
    {
      title: "Get Command",
      description: "Read the current or completed state and captured output of a command started by this account, optionally waiting up to 15 seconds.",
      inputSchema: getCommandRequestSchema,
      outputSchema: commandOutputSchema,
      _meta: toolMetadata,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ commandId, waitMs }) => {
      const deviceId = state.deviceForCommand(accountId, commandId);
      if (!deviceId) {
        return errorResult("command_not_found", "The command was not found.");
      }
      try {
        const result = await executeJob(state, config, accountId, deviceId, {
          type: "get_command",
          requestId: randomUUID(),
          commandId,
          ...(waitMs === undefined ? {} : { waitMs }),
        });
        return workerSuccess(result, commandOutputSchema);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "cancel_command",
    {
      title: "Cancel Command",
      description: "Terminate a running command and its process tree. Cancellation does not revert effects the command already caused.",
      inputSchema: cancelCommandRequestSchema,
      outputSchema: commandOutputSchema,
      _meta: toolMetadata,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ commandId }) => {
      const deviceId = state.deviceForCommand(accountId, commandId);
      if (!deviceId) {
        return errorResult("command_not_found", "The command was not found.");
      }
      try {
        const result = await executeJob(state, config, accountId, deviceId, {
          type: "cancel_command",
          requestId: randomUUID(),
          commandId,
        });
        return workerSuccess(result, commandOutputSchema);
      } catch (error) {
        return routedError(error);
      }
    },
  );

}

export function createMcpServer(
  config: RelayConfig,
  state: RouterState,
  accountId: string,
): McpServer {
  const server = new McpServer({
    name: "glossa",
    version: MCP_SERVER_VERSION,
  });
  registerTools(server, config, state, accountId);
  return server;
}

export async function handleMcpRequest(
  request: Request,
  response: Response,
  config: RelayConfig,
  state: RouterState,
  accountId: string,
): Promise<void> {
  const server = createMcpServer(config, state, accountId);
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(request, response, request.body);
  } finally {
    await transport.close();
    await server.close();
  }
}
