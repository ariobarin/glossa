import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { parseDeviceToken, verifyDeviceSecret } from "../src/device-token.js";
import { Store } from "../src/store.js";

test("account lookup activates a new or existing subject atomically", async () => {
  const queries: string[] = [];
  const values: unknown[][] = [];
  const pool = {
    query: async (text: string, queryValues?: unknown[]) => {
      queries.push(text);
      values.push(queryValues ?? []);
      return { rows: [{ id: "account-a" }] };
    },
  } as unknown as Pool;
  const store = new Store("unused", pool);

  assert.equal(await store.accountIdForSubject("github|123"), "account-a");
  assert.equal(queries.length, 1);
  assert.match(queries[0] ?? "", /^INSERT INTO accounts/);
  assert.match(queries[0] ?? "", /ON CONFLICT/);
  assert.match(queries[0] ?? "", /disabled_at IS NULL/);
  assert.equal(values[0]?.[1], "github|123");
});

test("enrollment stores only a salted device secret hash", async () => {
  let deviceValues: unknown[] = [];
  const queries: string[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      queries.push(text);
      if (text.includes("INSERT INTO devices")) {
        deviceValues = values ?? [];
        return {
          rows: [
            {
              id: deviceValues[0],
              account_id: deviceValues[1],
              name: deviceValues[2],
              platform: deviceValues[3],
              revoked_at: null,
              last_seen_at: null,
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = {
    connect: async () => client,
  } as unknown as Pool;
  const store = new Store("unused", pool);

  const enrolled = await store.enrollDevice(
    "account-a",
    "windows device",
    "win32-x64",
  );
  const parsed = parseDeviceToken(enrolled.token);
  assert.ok(parsed);
  assert.equal(deviceValues[0], parsed.deviceId);
  assert.ok(Buffer.isBuffer(deviceValues[4]));
  assert.ok(Buffer.isBuffer(deviceValues[5]));
  assert.equal(
    await verifyDeviceSecret(
      parsed.secret,
      deviceValues[4] as Buffer,
      deviceValues[5] as Buffer,
    ),
    true,
  );
  assert.equal(deviceValues.includes(enrolled.token), false);
  assert.equal(deviceValues.includes(parsed.secret), false);
  assert.ok(queries.some((query) => query.includes("INSERT INTO audit_events")));
});
