import assert from "node:assert/strict";
import test from "node:test";
import { RemoteWorker, type RemoteWorkerStatus } from "./remote-worker.js";

test("reports retry, connection, and graceful disconnection", async () => {
  const controller = new AbortController();
  const statuses: RemoteWorkerStatus[] = [];
  const paths: string[] = [];
  let registrations = 0;

  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (url.pathname === "/device/register") {
      registrations += 1;
      if (registrations === 1) throw new Error("relay unavailable");
      const body = JSON.parse(String(init?.body)) as { workerId: string };
      return Response.json({
        workerId: body.workerId,
        generation: "00000000-0000-4000-8000-000000000001",
      });
    }
    if (url.pathname === "/device/poll") {
      controller.abort();
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/device/unregister") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  };

  await new RemoteWorker({
    origin: "https://relay.glossa.test",
    deviceToken: "device-token",
    worker: { handle: async () => ({ requestId: "unused", ok: true }) },
    signal: controller.signal,
    fetcher,
    sleep: async () => {},
    onStatus: (status) => statuses.push(status),
  }).run();

  assert.deepEqual(statuses.map((status) => status.state), [
    "connecting",
    "retrying",
    "connected",
    "disconnected",
  ]);
  assert.deepEqual(paths, [
    "/device/register",
    "/device/register",
    "/device/poll",
    "/device/unregister",
  ]);
});
