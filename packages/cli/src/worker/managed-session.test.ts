import assert from "node:assert/strict";
import test from "node:test";
import { deviceForSession } from "./managed-session.js";

test("aborts relay setup fetches when the UI session stops", async () => {
  const controller = new AbortController();
  const endpoints = {
    relayOrigin: "https://relay.example",
    workerOrigin: "wss://worker.example",
  };
  const credentials = {
    issuer: "https://issuer.example",
    clientId: "client",
    audience: "relay",
    accessToken: "access",
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    tokenType: "Bearer",
  };
  const stored = {
    relayOrigin: endpoints.relayOrigin,
    deviceId: "device-id",
    deviceName: "Test device",
    token: "device-token",
  };
  let fetchStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    fetchStarted = resolve;
  });

  const pending = deviceForSession(
    endpoints,
    {
      loadDeviceCredential: async () => stored,
      loadCredentials: async () => ({ credentials, backend: "keyring" }),
      fetch: async (_input, init) => {
        assert.equal(init?.signal, controller.signal);
        fetchStarted();
        return await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }
          if (signal.aborted) reject(signal.reason);
          else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    },
    controller.signal,
  );

  await started;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
