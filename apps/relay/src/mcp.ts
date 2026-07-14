import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_COMMAND_STATUS_WAIT_MS,
  MAX_COMMAND_TIMEOUT_MS,
  MAX_TEXT_BYTES,
  type WorkerJob,
  type WorkerResult,
} from "@glossa/protocol";
import type { RelayConfig } from "./config.js";
import type { RouterState } from "./router-state.js";

const relativePathSchema = z.string().max(4096);
const workspaceResultSchema = z.object({
  workspaceId: z.string().uuid(),
  path: z.string(),
  expiresAt: z.string(),
});
const commandResultSchema = z.object({ commandId: z.string().uuid() }).passthrough();

const safeWorkerMessages: Record<string, string> = {
  path_not_found: "The requested path does not exist.",
  path_escape: "The requested path escapes the exposed root.",
  not_directory: "The requested workspace is not a directory.",
  workspace_expired: "The workspace lease has expired.",
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

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
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
  server.registerTool(
    "list_devices",
    {
      title: "List Devices",
      description: "List this account's connected Glossa devices.",
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => textResult({ devices: state.listDevices(accountId) }),
  );

  server.registerTool(
    "open_workspace",
    {
      title: "Open Workspace",
      description: "Open a root-relative workspace on a connected device.",
      inputSchema: z
        .object({
          deviceId: z.string().uuid(),
          path: relativePathSchema.default("."),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ deviceId, path }) => {
      const job: WorkerJob = {
        type: "open_workspace",
        requestId: randomUUID(),
        path,
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
        const parsed = workspaceResultSchema.safeParse(result.value);
        if (!parsed.success) {
          return errorResult("invalid_worker_result", "The worker returned an invalid workspace.");
        }
        state.rememberWorkspace(accountId, deviceId, parsed.data.workspaceId);
        return textResult(parsed.data);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "read_file",
    {
      title: "Read File",
      description: "Read one UTF-8 text file within an open workspace.",
      inputSchema: z
        .object({
          workspaceId: z.string().uuid(),
          path: relativePathSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ workspaceId, path }) => {
      const deviceId = state.deviceForWorkspace(accountId, workspaceId);
      if (!deviceId) {
        return errorResult("workspace_expired", "The workspace lease has expired.");
      }
      try {
        const result = await executeJob(state, config, accountId, deviceId, {
          type: "read_file",
          requestId: randomUUID(),
          workspaceId,
          path,
        });
        return result.ok ? textResult(result.value) : workerError(result);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "write_file",
    {
      title: "Write File",
      description: "Atomically write one UTF-8 text file within an open workspace.",
      inputSchema: z
        .object({
          workspaceId: z.string().uuid(),
          path: relativePathSchema,
          content: z
            .string()
            .refine((value) => Buffer.byteLength(value, "utf8") <= MAX_TEXT_BYTES),
          expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async ({ workspaceId, path, content, expectedSha256 }) => {
      const deviceId = state.deviceForWorkspace(accountId, workspaceId);
      if (!deviceId) {
        return errorResult("workspace_expired", "The workspace lease has expired.");
      }
      const job: WorkerJob = {
        type: "write_file",
        requestId: randomUUID(),
        workspaceId,
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
        return result.ok ? textResult(result.value) : workerError(result);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "run_command",
    {
      title: "Run Command",
      description: "Start a bounded command with the full authority of the worker account.",
      inputSchema: z
        .object({
          workspaceId: z.string().uuid(),
          argv: z.array(z.string()).min(1).max(256).optional(),
          shellCommand: z.string().max(64 * 1024).optional(),
          stdin: z
            .string()
            .refine((value) => Buffer.byteLength(value, "utf8") <= MAX_TEXT_BYTES)
            .optional(),
          timeoutMs: z
            .number()
            .int()
            .min(1)
            .max(MAX_COMMAND_TIMEOUT_MS)
            .default(DEFAULT_COMMAND_TIMEOUT_MS),
        })
        .strict()
        .superRefine((value, context) => {
          if ((value.argv ? 1 : 0) + (value.shellCommand ? 1 : 0) !== 1) {
            context.addIssue({
              code: "custom",
              message: "Exactly one of argv or shellCommand is required.",
            });
          }
        }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async ({ workspaceId, argv, shellCommand, stdin, timeoutMs }) => {
      const deviceId = state.deviceForWorkspace(accountId, workspaceId);
      if (!deviceId) {
        return errorResult("workspace_expired", "The workspace lease has expired.");
      }
      const job: WorkerJob = {
        type: "run_command",
        requestId: randomUUID(),
        workspaceId,
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
        const parsed = commandResultSchema.safeParse(result.value);
        if (!parsed.success) {
          return errorResult("invalid_worker_result", "The worker returned an invalid command.");
        }
        state.rememberCommand(accountId, deviceId, parsed.data.commandId);
        return textResult(parsed.data);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "get_command",
    {
      title: "Get Command",
      description: "Get current or completed command state, optionally waiting up to 15 seconds.",
      inputSchema: z
        .object({
          commandId: z.string().uuid(),
          waitMs: z
            .number()
            .int()
            .min(0)
            .max(MAX_COMMAND_STATUS_WAIT_MS)
            .optional(),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
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
        return result.ok ? textResult(result.value) : workerError(result);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "cancel_command",
    {
      title: "Cancel Command",
      description: "Terminate a running command and its process tree.",
      inputSchema: z.object({ commandId: z.string().uuid() }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
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
        return result.ok ? textResult(result.value) : workerError(result);
      } catch (error) {
        return routedError(error);
      }
    },
  );

  server.registerTool(
    "close_workspace",
    {
      title: "Close Workspace",
      description: "Close a transient workspace lease.",
      inputSchema: z.object({ workspaceId: z.string().uuid() }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ workspaceId }) => {
      const deviceId = state.deviceForWorkspace(accountId, workspaceId);
      if (!deviceId) {
        return errorResult("workspace_expired", "The workspace lease has expired.");
      }
      try {
        const result = await executeJob(state, config, accountId, deviceId, {
          type: "close_workspace",
          requestId: randomUUID(),
          workspaceId,
        });
        if (!result.ok) return workerError(result);
        state.forgetWorkspace(accountId, workspaceId);
        return textResult(result.value);
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
  const server = new McpServer({ name: "glossa", version: "0.0.0" });
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
