import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { parseDeviceToken, verifyDeviceSecret } from "../src/device-token.js";
import { Store } from "../src/store.js";

test("account lookup selects an admitted row without creating one", async () => {
  const queries: string[] = [];
  const pool = {
    query: async (text: string) => {
      queries.push(text);
      return { rows: [{ id: "account-a" }] };
    },
  } as unknown as Pool;
  const store = new Store("unused", pool);

  assert.equal(await store.admittedAccountIdForSubject("github|123"), "account-a");
  assert.equal(queries.length, 1);
  assert.match(queries[0] ?? "", /^SELECT id/);
  assert.match(queries[0] ?? "", /admitted_at IS NOT NULL/);
  assert.doesNotMatch(queries[0] ?? "", /INSERT|UPDATE/);
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
