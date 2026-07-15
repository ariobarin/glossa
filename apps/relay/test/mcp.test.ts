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

test("MCP tools expose accurate metadata and account-scoped devices", async (context) => {
  const state = new RouterState();
  const firstAccount = randomUUID();
  const secondAccount = randomUUID();
  const firstDevice = randomUUID();
  const secondDevice = randomUUID();
  const firstGeneration = state.register(firstAccount, firstDevice);
  state.register(secondAccount, secondDevice);
  const first = await connectClient(state, firstAccount);
  const second = await connectClient(state, secondAccount);
  context.after(async () => {
    await first.client.close();
    await first.server.close();
    await second.client.close();
    await second.server.close();
  });

  const tools = await first.client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "cancel_command",
      "get_command",
      "list_devices",
      "read_file",
      "run_command",
      "write_file",
    ],
  );
  const writeTool = tools.tools.find((tool) => tool.name === "write_file");
  assert.equal(writeTool?.annotations?.readOnlyHint, false);
  assert.equal(writeTool?.annotations?.destructiveHint, true);
  assert.equal(writeTool?.annotations?.openWorldHint, false);

  const listed = await first.client.callTool({
    name: "list_devices",
    arguments: {},
  });
  assert.deepEqual(parsedText(listed), {
    devices: [{ deviceId: firstDevice, path: "." }],
  });

  const crossAccount = await first.client.callTool({
    name: "read_file",
    arguments: { deviceId: secondDevice, path: "README.md" },
  });
  assert.equal(crossAccount.isError, true);
  assert.deepEqual(parsedText(crossAccount), {
    error: { code: "device_offline", message: "The device is offline." },
  });

  const response = respondOnce(
    state,
    firstAccount,
    firstDevice,
    firstGeneration,
    (job) => {
      assert.equal(job.type, "read_file");
      if (job.type !== "read_file") throw new Error("Expected read job.");
      assert.equal(job.path, "README.md");
      return {
        requestId: job.requestId,
        ok: true,
        value: { content: "hello", sha256: "abc", bytes: 5 },
      };
    },
  );
  const read = await first.client.callTool({
    name: "read_file",
    arguments: { deviceId: firstDevice, path: "README.md" },
  });
  await response;
  assert.deepEqual(parsedText(read), {
    content: "hello",
    sha256: "abc",
    bytes: 5,
  });
});

test("command identifiers cannot cross accounts", async (context) => {
  const state = new RouterState();
  const firstAccount = randomUUID();
  const secondAccount = randomUUID();
  const deviceId = randomUUID();
  const generation = state.register(firstAccount, deviceId);
  const first = await connectClient(state, firstAccount);
  const second = await connectClient(state, secondAccount);
  context.after(async () => {
    await first.client.close();
    await first.server.close();
    await second.client.close();
    await second.server.close();
  });

  const commandId = randomUUID();
  const response = respondOnce(state, firstAccount, deviceId, generation, (job) => ({
    requestId: job.requestId,
    ok: true,
    value: { commandId, status: "running", startedAt: new Date().toISOString() },
  }));
  const started = await first.client.callTool({
    name: "run_command",
    arguments: { deviceId, argv: ["git", "status"] },
  });
  await response;
  assert.equal((parsedText(started) as { commandId: string }).commandId, commandId);

  const blocked = await second.client.callTool({
    name: "get_command",
    arguments: { commandId },
  });
  assert.equal(blocked.isError, true);
  assert.deepEqual(parsedText(blocked), {
    error: { code: "command_not_found", message: "The command was not found." },
  });
});
