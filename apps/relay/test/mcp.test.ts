import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { WorkerJob, WorkerResult } from "@glossa/protocol";
import { loadConfig } from "../src/config.js";
import { createMcpServer } from "../src/mcp.js";
import { RouterState } from "../src/router-state.js";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost/glossa",
  GLOSSA_PUBLIC_ORIGIN: "https://mcp.glossa.sh",
  GLOSSA_AUTH0_ISSUER: "https://tenant.example.com/",
  GLOSSA_AUTH0_AUDIENCE: "https://mcp.glossa.sh/",
  GLOSSA_RELAY_REQUEST_TIMEOUT_MS: "1000",
});

async function connectClient(state: RouterState, accountId: string) {
  const server = createMcpServer(config, state, accountId);
  const client = new Client({ name: "glossa-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport as unknown as Transport);
  await client.connect(clientTransport as unknown as Transport);
  return { client, server };
}

async function respondOnce(
  state: RouterState,
  accountId: string,
  deviceId: string,
  generation: string,
  handler: (job: WorkerJob) => WorkerResult,
): Promise<void> {
  const job = await state.poll(accountId, deviceId, generation, 1_000);
  assert.ok(job);
  assert.equal(state.complete(accountId, deviceId, handler(job)), true);
}

function parsedText(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const first = (result as CallToolResult).content[0];
  assert.ok(first);
  assert.equal(first.type, "text");
  if (first.type !== "text") throw new Error("Expected text tool content.");
  return JSON.parse(first.text) as unknown;
}

test("MCP tools route only within their authenticated account", async (context) => {
  const state = new RouterState();
  const firstAccount = randomUUID();
  const secondAccount = randomUUID();
  const firstDevice = randomUUID();
  const secondDevice = randomUUID();
  const firstGeneration = state.register(firstAccount, firstDevice);
  state.register(secondAccount, secondDevice);
  const firstConnection = await connectClient(state, firstAccount);
  const secondConnection = await connectClient(state, secondAccount);
  context.after(async () => {
    await firstConnection.client.close();
    await firstConnection.server.close();
    await secondConnection.client.close();
    await secondConnection.server.close();
  });

  const tools = await firstConnection.client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "cancel_command",
      "close_workspace",
      "get_command",
      "list_devices",
      "open_workspace",
      "read_file",
      "run_command",
      "write_file",
    ],
  );
  const writeTool = tools.tools.find((tool) => tool.name === "write_file");
  const runTool = tools.tools.find((tool) => tool.name === "run_command");
  assert.equal(writeTool?.annotations?.readOnlyHint, false);
  assert.equal(writeTool?.annotations?.destructiveHint, true);
  assert.equal(runTool?.annotations?.readOnlyHint, false);
  assert.equal(runTool?.annotations?.destructiveHint, true);

  const listed = await firstConnection.client.callTool({
    name: "list_devices",
    arguments: {},
  });
  assert.deepEqual(parsedText(listed), {
    devices: [{ deviceId: firstDevice, path: "." }],
  });

  const crossAccountOpen = await firstConnection.client.callTool({
    name: "open_workspace",
    arguments: { deviceId: secondDevice, path: "." },
  });
  assert.equal(crossAccountOpen.isError, true);
  assert.deepEqual(parsedText(crossAccountOpen), {
    error: { code: "device_offline", message: "The device is offline." },
  });

  const workspaceId = randomUUID();
  const openResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => {
      assert.equal(job.type, "open_workspace");
      return {
        requestId: job.requestId,
        ok: true,
        value: {
          workspaceId,
          path: ".",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      };
    },
  );
  const opened = await firstConnection.client.callTool({
    name: "open_workspace",
    arguments: { deviceId: firstDevice },
  });
  await openResponse;
  assert.equal((parsedText(opened) as { workspaceId: string }).workspaceId, workspaceId);

  for (const [name, argumentsValue] of [
    ["read_file", { workspaceId, path: "README.md" }],
    ["write_file", { workspaceId, path: "note.txt", content: "blocked" }],
    ["run_command", { workspaceId, argv: ["git", "status"] }],
    ["close_workspace", { workspaceId }],
  ] as const) {
    const result = await secondConnection.client.callTool({
      name,
      arguments: argumentsValue,
    });
    assert.equal(result.isError, true);
    assert.equal(
      (parsedText(result) as { error: { code: string } }).error.code,
      "workspace_expired",
    );
  }

  const readResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => {
      assert.equal(job.type, "read_file");
      return {
        requestId: job.requestId,
        ok: true,
        value: { content: "hello", sha256: "a".repeat(64), bytes: 5 },
      };
    },
  );
  const read = await firstConnection.client.callTool({
    name: "read_file",
    arguments: { workspaceId, path: "README.md" },
  });
  await readResponse;
  assert.equal((parsedText(read) as { content: string }).content, "hello");

  const writeResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => {
      assert.equal(job.type, "write_file");
      return {
        requestId: job.requestId,
        ok: true,
        value: { sha256: "b".repeat(64), bytes: 7 },
      };
    },
  );
  const write = await firstConnection.client.callTool({
    name: "write_file",
    arguments: { workspaceId, path: "note.txt", content: "updated" },
  });
  await writeResponse;
  assert.equal((parsedText(write) as { bytes: number }).bytes, 7);

  const commandId = randomUUID();
  const runResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => {
      assert.equal(job.type, "run_command");
      if (job.type !== "run_command") throw new Error("Expected run command job.");
      assert.equal(job.timeoutMs, 15 * 60 * 1_000);
      return {
        requestId: job.requestId,
        ok: true,
        value: {
          commandId,
          status: "running",
          startedAt: new Date().toISOString(),
        },
      };
    },
  );
  const run = await firstConnection.client.callTool({
    name: "run_command",
    arguments: { workspaceId, argv: ["git", "status"] },
  });
  await runResponse;
  assert.equal((parsedText(run) as { commandId: string }).commandId, commandId);

  for (const name of ["get_command", "cancel_command"] as const) {
    const result = await secondConnection.client.callTool({
      name,
      arguments: { commandId },
    });
    assert.equal(result.isError, true);
    assert.equal(
      (parsedText(result) as { error: { code: string } }).error.code,
      "command_not_found",
    );
  }

  const getResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => {
      assert.equal(job.type, "get_command");
      if (job.type !== "get_command") throw new Error("Expected get command job.");
      assert.equal(job.waitMs, 15_000);
      return {
        requestId: job.requestId,
        ok: true,
        value: { commandId, status: "running", startedAt: new Date().toISOString() },
      };
    },
  );
  const command = await firstConnection.client.callTool({
    name: "get_command",
    arguments: { commandId, waitMs: 15_000 },
  });
  await getResponse;
  assert.equal((parsedText(command) as { status: string }).status, "running");

  const cancelResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => ({
      requestId: job.requestId,
      ok: true,
      value: { commandId, status: "canceled", startedAt: new Date().toISOString() },
    }),
  );
  const canceled = await firstConnection.client.callTool({
    name: "cancel_command",
    arguments: { commandId },
  });
  await cancelResponse;
  assert.equal((parsedText(canceled) as { status: string }).status, "canceled");

  const closeResponse = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => ({
      requestId: job.requestId,
      ok: true,
      value: { closed: true },
    }),
  );
  const closed = await firstConnection.client.callTool({
    name: "close_workspace",
    arguments: { workspaceId },
  });
  await closeResponse;
  assert.deepEqual(parsedText(closed), { closed: true });

  const readAfterClose = await firstConnection.client.callTool({
    name: "read_file",
    arguments: { workspaceId, path: "README.md" },
  });
  assert.equal(readAfterClose.isError, true);
  assert.equal(
    (parsedText(readAfterClose) as { error: { code: string } }).error.code,
    "workspace_expired",
  );
});

test("worker errors are returned without trusting worker messages", async (context) => {
  const state = new RouterState();
  const accountId = randomUUID();
  const deviceId = randomUUID();
  const generation = state.register(accountId, deviceId);
  const connection = await connectClient(state, accountId);
  context.after(async () => {
    await connection.client.close();
    await connection.server.close();
  });

  const response = respondOnce(state, accountId, deviceId, generation, (job) => ({
    requestId: job.requestId,
    ok: false,
    error: {
      code: "path_escape",
      message: "C:\\private\\source must not reach the client",
    },
  }));
  const result = await connection.client.callTool({
    name: "open_workspace",
    arguments: { deviceId, path: ".." },
  });
  await response;

  assert.equal(result.isError, true);
  assert.deepEqual(parsedText(result), {
    error: {
      code: "path_escape",
      message: "The requested path escapes the exposed root.",
    },
  });
});
