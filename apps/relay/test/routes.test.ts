import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import express, {
  type NextFunction,
  type Request,
  type Response as ExpressResponse,
} from "express";
import { loadConfig } from "../src/config.js";
import type { RelayConfig } from "../src/config.js";
import type { AuthenticatedRequest } from "../src/auth.js";
import { FixedWindowRateLimiter } from "../src/rate-limit.js";
import { RouterState } from "../src/router-state.js";
import { buildRoutes, type RouteDependencies } from "../src/routes.js";
import type { DeviceRecord, RelayStore } from "../src/store.js";

interface StoredDevice extends DeviceRecord {
  secret: string;
}

class MemoryStore implements RelayStore {
  readonly admittedAccounts = new Map<string, string>();
  readonly devices = new Map<string, StoredDevice>();
  enrollmentCalls = 0;

  admit(subject: string, accountId = randomUUID()): string {
    this.admittedAccounts.set(subject, accountId);
    return accountId;
  }

  async admittedAccountIdForSubject(subject: string): Promise<string | null> {
    return this.admittedAccounts.get(subject) ?? null;
  }

  async enrollDevice(
    accountId: string,
    name: string,
    platform: string | null,
  ): Promise<{ device: DeviceRecord; token: string }> {
    this.enrollmentCalls += 1;
    const id = randomUUID();
    const secret = randomBytes(32).toString("base64url");
    const device: StoredDevice = {
      id,
      accountId,
      name,
      platform,
      revokedAt: null,
      lastSeenAt: null,
      secret,
    };
    this.devices.set(id, device);
    return { device, token: `gld_${id}_${secret}` };
  }

  async listDevices(accountId: string): Promise<DeviceRecord[]> {
    return [...this.devices.values()].filter(
      (device) => device.accountId === accountId,
    );
  }

  async renameDevice(
    accountId: string,
    deviceId: string,
    name: string,
  ): Promise<DeviceRecord | null> {
    const device = this.devices.get(deviceId);
    if (
      !device ||
      device.accountId !== accountId ||
      device.revokedAt !== null
    ) {
      return null;
    }
    device.name = name;
    return device;
  }

  async revokeDevice(accountId: string, deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (
      !device ||
      device.accountId !== accountId ||
      device.revokedAt !== null
    ) {
      return false;
    }
    device.revokedAt = new Date();
    return true;
  }

  async authenticateDevice(
    deviceId: string,
    secret: string,
  ): Promise<DeviceRecord | null> {
    const device = this.devices.get(deviceId);
    if (!device || device.revokedAt || device.secret !== secret) return null;
    device.lastSeenAt = new Date();
    return device;
  }
}

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost/glossa",
  GLOSSA_PUBLIC_ORIGIN: "https://mcp.glossa.sh",
  GLOSSA_AUTH0_ISSUER: "https://tenant.example.com/",
  GLOSSA_AUTH0_AUDIENCE: "https://mcp.glossa.sh/",
  GLOSSA_WORKER_POLL_MS: "1",
  GLOSSA_ENROLL_RATE_LIMIT: "100",
  GLOSSA_DEVICE_AUTH_RATE_LIMIT: "100",
});

const testAuthFactory: NonNullable<RouteDependencies["authFactory"]> = () =>
  (request: Request, response: ExpressResponse, next: NextFunction): void => {
    const [scheme, subject] =
      request.header("authorization")?.split(/\s+/, 2) ?? [];
    if (scheme !== "Bearer" || !subject) {
      response.status(401).json({ error: "authentication_required" });
      return;
    }
    (request as AuthenticatedRequest).auth = {
      subject,
      scopes: new Set(["glossa:device", "glossa:access"]),
      claims: { sub: subject },
    };
    next();
  };

async function startRelay(
  context: TestContext,
  store: MemoryStore,
  relayConfig: RelayConfig = config,
  dependencies: RouteDependencies = {},
): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use(
    buildRoutes(relayConfig, store, new RouterState(), {
      ...dependencies,
      authFactory: testAuthFactory,
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function jsonRequest(
  origin: string,
  path: string,
  method: string,
  authorization: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { authorization };
  if (body !== undefined) headers["content-type"] = "application/json";
  return await fetch(`${origin}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function enroll(
  origin: string,
  subject: string,
  name: string,
): Promise<{ device: DeviceRecord; device_token: string }> {
  const response = await jsonRequest(
    origin,
    "/v1/devices/enroll",
    "POST",
    `Bearer ${subject}`,
    { name, platform: "win32-x64" },
  );
  assert.equal(response.status, 201);
  return (await response.json()) as {
    device: DeviceRecord;
    device_token: string;
  };
}

test("unadmitted identities cannot create accounts or devices", async (context) => {
  const store = new MemoryStore();
  const origin = await startRelay(context, store);

  const response = await jsonRequest(
    origin,
    "/v1/devices/enroll",
    "POST",
    "Bearer subject-uninvited",
    { name: "uninvited device" },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "account_not_admitted" });
  assert.equal(store.admittedAccounts.size, 0);
  assert.equal(store.enrollmentCalls, 0);
});

test("enrollment returns a stable rate limit response", async (context) => {
  const store = new MemoryStore();
  store.admit("subject-a");
  const origin = await startRelay(context, store, config, {
    enrollmentRateLimiter: new FixedWindowRateLimiter(1, 60_000),
  });

  await enroll(origin, "subject-a", "first device");
  const response = await jsonRequest(
    origin,
    "/v1/devices/enroll",
    "POST",
    "Bearer subject-a",
    { name: "second device" },
  );

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: "rate_limited" });
  assert.equal(response.headers.get("retry-after"), "60");
});

test("production routes reject cleartext credentials", async (context) => {
  const store = new MemoryStore();
  const origin = await startRelay(context, store, {
    ...config,
    NODE_ENV: "production",
  });

  const response = await jsonRequest(
    origin,
    "/device/register",
    "POST",
    "Device invalid",
    {},
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "https_required" });
});

test("device management remains scoped to its admitted account", async (context) => {
  const store = new MemoryStore();
  store.admit("subject-a");
  store.admit("subject-b");
  const origin = await startRelay(context, store);
  const first = await enroll(origin, "subject-a", "first device");
  const second = await enroll(origin, "subject-b", "second device");

  const firstList = await jsonRequest(
    origin,
    "/v1/devices",
    "GET",
    "Bearer subject-a",
  );
  assert.equal(firstList.status, 200);
  const listed = (await firstList.json()) as { devices: DeviceRecord[] };
  assert.deepEqual(
    listed.devices.map((device) => device.id),
    [first.device.id],
  );

  const crossAccountRename = await jsonRequest(
    origin,
    `/v1/devices/${second.device.id}`,
    "PATCH",
    "Bearer subject-a",
    { name: "stolen" },
  );
  assert.equal(crossAccountRename.status, 404);

  const renamed = await jsonRequest(
    origin,
    `/v1/devices/${first.device.id}`,
    "PATCH",
    "Bearer subject-a",
    { name: "renamed device" },
  );
  assert.equal(renamed.status, 200);
  const renamedBody = (await renamed.json()) as { device: DeviceRecord };
  assert.equal(renamedBody.device.name, "renamed device");

  const crossAccountRevoke = await jsonRequest(
    origin,
    `/v1/devices/${second.device.id}`,
    "DELETE",
    "Bearer subject-a",
  );
  assert.equal(crossAccountRevoke.status, 404);
  assert.equal(store.devices.get(second.device.id)?.revokedAt, null);
});

test("revocation blocks the next poll without affecting another device", async (context) => {
  const store = new MemoryStore();
  store.admit("subject-a");
  const origin = await startRelay(context, store);
  const revoked = await enroll(origin, "subject-a", "revoked device");
  const active = await enroll(origin, "subject-a", "active device");

  const revokedRegister = await jsonRequest(
    origin,
    "/device/register",
    "POST",
    `Device ${revoked.device_token}`,
    {},
  );
  assert.equal(revokedRegister.status, 200);
  const revokedGeneration = (await revokedRegister.json()) as {
    generation: string;
  };

  const activeRegister = await jsonRequest(
    origin,
    "/device/register",
    "POST",
    `Device ${active.device_token}`,
    {},
  );
  assert.equal(activeRegister.status, 200);
  const activeGeneration = (await activeRegister.json()) as {
    generation: string;
  };

  const revokeResponse = await jsonRequest(
    origin,
    `/v1/devices/${revoked.device.id}`,
    "DELETE",
    "Bearer subject-a",
  );
  assert.equal(revokeResponse.status, 204);

  const rejectedPoll = await jsonRequest(
    origin,
    "/device/poll",
    "POST",
    `Device ${revoked.device_token}`,
    { generation: revokedGeneration.generation },
  );
  assert.equal(rejectedPoll.status, 401);
  assert.deepEqual(await rejectedPoll.json(), { error: "invalid_device" });

  const activePoll = await jsonRequest(
    origin,
    "/device/poll",
    "POST",
    `Device ${active.device_token}`,
    { generation: activeGeneration.generation },
  );
  assert.equal(activePoll.status, 204);
  assert.ok(store.devices.get(active.device.id)?.lastSeenAt);
});
