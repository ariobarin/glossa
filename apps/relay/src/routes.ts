import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { deviceNameSchema, workerResultSchema } from "@glossa/protocol";
import type { RelayConfig } from "./config.js";
import { requireAuth, type AuthenticatedRequest } from "./auth.js";
import { parseDeviceToken } from "./device-token.js";
import type { Store, DeviceRecord } from "./store.js";
import type { RouterState } from "./router-state.js";

const enrollSchema = z.object({
  name: deviceNameSchema,
  platform: z.string().trim().min(1).max(80).nullable().optional(),
});

const registerSchema = z.object({}).strict();

const pollSchema = z.object({
  generation: z.string().uuid(),
});

function publicDevice(device: DeviceRecord) {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
  };
}

async function authenticatedDevice(
  request: Request,
  store: Store,
): Promise<DeviceRecord | null> {
  const header = request.header("authorization");
  const [scheme, token] = header?.split(/\s+/, 2) ?? [];
  if (scheme?.toLowerCase() !== "device" || !token) return null;
  const parsed = parseDeviceToken(token);
  if (!parsed) return null;
  return await store.authenticateDevice(parsed.deviceId, parsed.secret);
}

export function buildRoutes(
  config: RelayConfig,
  store: Store,
  state: RouterState,
): Router {
  const router = Router();

  router.get("/healthz", (_request, response) => {
    response.json({ ok: true, service: "glossa-relay" });
  });

  router.get("/.well-known/oauth-protected-resource", (_request, response) => {
    response.json({
      resource: `${config.GLOSSA_PUBLIC_ORIGIN}/mcp`,
      authorization_servers: [config.GLOSSA_AUTH0_ISSUER],
      scopes_supported: [
        config.GLOSSA_MCP_REQUIRED_SCOPE,
        config.GLOSSA_DEVICE_ENROLL_SCOPE,
      ],
      bearer_methods_supported: ["header"],
    });
  });

  router.post(
    "/v1/devices/enroll",
    requireAuth(config, config.GLOSSA_DEVICE_ENROLL_SCOPE),
    async (request: AuthenticatedRequest, response: Response) => {
      const input = enrollSchema.parse(request.body);
      const accountId = await store.accountIdForSubject(request.auth!.subject);
      const enrolled = await store.enrollDevice(
        accountId,
        input.name,
        input.platform ?? null,
      );
      response.status(201).json({
        device: publicDevice(enrolled.device),
        device_token: enrolled.token,
      });
    },
  );

  router.get(
    "/v1/devices",
    requireAuth(config, config.GLOSSA_DEVICE_ENROLL_SCOPE),
    async (request: AuthenticatedRequest, response: Response) => {
      const accountId = await store.accountIdForSubject(request.auth!.subject);
      const devices = await store.listDevices(accountId);
      response.json({ devices: devices.map(publicDevice) });
    },
  );

  router.delete(
    "/v1/devices/:deviceId",
    requireAuth(config, config.GLOSSA_DEVICE_ENROLL_SCOPE),
    async (request: AuthenticatedRequest, response: Response) => {
      const accountId = await store.accountIdForSubject(request.auth!.subject);
      const rawDeviceId = request.params.deviceId;
      const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;
      if (!deviceId) {
        response.status(400).json({ error: "invalid_device_id" });
        return;
      }
      const revoked = await store.revokeDevice(accountId, deviceId);
      if (!revoked) {
        response.status(404).json({ error: "device_not_found" });
        return;
      }
      state.unregister(deviceId);
      response.status(204).end();
    },
  );

  router.post("/device/register", async (request, response) => {
    const device = await authenticatedDevice(request, store);
    if (!device) {
      response.status(401).json({ error: "invalid_device" });
      return;
    }
    registerSchema.parse(request.body ?? {});
    const generation = state.register(device.accountId, device.id);
    response.json({ deviceId: device.id, generation });
  });

  router.post("/device/poll", async (request, response) => {
    const device = await authenticatedDevice(request, store);
    if (!device) {
      response.status(401).json({ error: "invalid_device" });
      return;
    }
    const input = pollSchema.parse(request.body);
    try {
      const job = await state.poll(
        device.accountId,
        device.id,
        input.generation,
        config.GLOSSA_WORKER_POLL_MS,
      );
      if (!job) {
        response.status(204).end();
        return;
      }
      response.json({ job });
    } catch {
      response.status(409).json({ error: "unknown_device_generation" });
    }
  });

  router.post("/device/result", async (request, response) => {
    const device = await authenticatedDevice(request, store);
    if (!device) {
      response.status(401).json({ error: "invalid_device" });
      return;
    }
    const result = workerResultSchema.parse(request.body);
    const accepted = state.complete(device.accountId, device.id, result);
    response.status(accepted ? 202 : 410).json({ accepted });
  });

  router.post(
    "/mcp",
    requireAuth(config, config.GLOSSA_MCP_REQUIRED_SCOPE),
    (_request, response) => {
      response.status(501).json({
        error: "mcp_adapter_not_implemented",
        next: "Complete milestones M1 and M4 by implementing the Glossa MCP adapter.",
      });
    },
  );

  return router;
}
