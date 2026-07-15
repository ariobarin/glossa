import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerJob, WorkerResult } from "@glossa/protocol";
import {
  reconnectDelayMs,
  RemoteWorker,
  type WorkerHandler,
} from "../src/worker/remote-worker.js";

const requestId = "11111111-1111-4111-8111-111111111111";
const generation = "22222222-2222-4222-8222-222222222222";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("reconnect delay uses bounded exponential jitter", () => {
  assert.equal(reconnectDelayMs(0, () => 0, 1_000, 10_000), 500);
  assert.equal(reconnectDelayMs(2, () => 1, 1_000, 10_000), 4_000);
  assert.equal(reconnectDelayMs(20, () => 1, 1_000, 10_000), 10_000);
});

test("worker reconnects with jitter after a relay failure", async () => {
  const controller = new AbortController();
  const paths: string[] = [];
  const delays: number[] = [];
  let registrations = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (url.pathname === "/device/register") {
      registrations += 1;
      return registrations === 1
        ? jsonResponse({ error: "temporary" }, 503)
        : jsonResponse({ generation });
    }
    controller.abort();
    return new Response(null, { status: 204 });
  };
  const worker: WorkerHandler = {
    async handle(_job: WorkerJob): Promise<WorkerResult> {
      throw new Error("No job expected.");
    },
  };

  await new RemoteWorker({
    origin: "https://mcp.glossa.sh",
    deviceToken: "test-token",
    worker,
    signal: controller.signal,
    fetcher,
    random: () => 0,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
    reconnectBaseMs: 1_000,
  }).run();

  assert.deepEqual(paths, [
    "/device/register",
    "/device/register",
    "/device/poll",
  ]);
  assert.deepEqual(delays, [500]);
});

test("worker posts the local result for a valid job", async () => {
  const controller = new AbortController();
  const requests: Array<{ path: string; body: unknown; authorization: string | null }> = [];
  const job: WorkerJob = {
    type: "read_file",
    requestId,
    path: "README.md",
  };
  const result: WorkerResult = { requestId, ok: true, value: { content: "read me" } };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      path: url.pathname,
      body: JSON.parse(String(init?.body)) as unknown,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (url.pathname === "/device/register") return jsonResponse({ generation });
    if (url.pathname === "/device/poll") return jsonResponse({ job });
    controller.abort();
    return jsonResponse({ accepted: true }, 202);
  };
  const worker: WorkerHandler = {
    async handle(received): Promise<WorkerResult> {
      assert.deepEqual(received, job);
      return result;
    },
  };

  await new RemoteWorker({
    origin: "https://mcp.glossa.sh",
    deviceToken: "device-secret",
    worker,
    signal: controller.signal,
    fetcher,
  }).run();

  assert.deepEqual(
    requests.map(({ path }) => path),
    ["/device/register", "/device/poll", "/device/result"],
  );
  assert.deepEqual(requests[2]?.body, result);
  assert.equal(requests[0]?.authorization, "Device device-secret");
});
