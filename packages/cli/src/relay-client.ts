import os from "node:os";
import { deviceNameSchema } from "@glossa/protocol";
import type { StoredCredentials } from "./config-store.js";
import type { FetchLike } from "./auth-session.js";
import type { StoredDeviceCredential } from "./device-store.js";

const DEFAULT_RELAY_ORIGIN = "https://mcp.glossa.sh";

export interface RelayEndpoints {
  relayOrigin: string;
  workerOrigin: string;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function normalizedOrigin(value: string, kind: "relay" | "worker"): string {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`GLOSSA_${kind === "relay" ? "RELAY" : "WORKER"}_ORIGIN must contain only an origin.`);
  }
  if (url.protocol === "https:") return url.origin;
  const allowedHttp =
    url.protocol === "http:" &&
    (isLoopback(url.hostname) || (kind === "worker" && isPrivateIpv4(url.hostname)));
  if (!allowedHttp) {
    throw new Error(
      `GLOSSA_${kind === "relay" ? "RELAY" : "WORKER"}_ORIGIN must use HTTPS${
        kind === "worker" ? " unless it is a loopback or private IPv4 address" : " unless it is loopback"
      }.`,
    );
  }
  return url.origin;
}

export function loadRelayEndpoints(
  environment: NodeJS.ProcessEnv = process.env,
): RelayEndpoints {
  const relayOrigin = normalizedOrigin(
    environment.GLOSSA_RELAY_ORIGIN?.trim() || DEFAULT_RELAY_ORIGIN,
    "relay",
  );
  const workerOrigin = normalizedOrigin(
    environment.GLOSSA_WORKER_ORIGIN?.trim() || relayOrigin,
    "worker",
  );
  return { relayOrigin, workerOrigin };
}

export function defaultDeviceName(): string {
  return deviceNameSchema.parse(os.hostname());
}

interface EnrollmentResponse {
  device?: { id?: unknown; name?: unknown };
  device_token?: unknown;
  error?: unknown;
}

interface DeviceListResponse {
  devices?: Array<{ id?: unknown; revokedAt?: unknown }>;
  error?: unknown;
}

function enrollmentError(status: number, data: EnrollmentResponse): Error {
  if (status === 401) return new Error("Glossa login was rejected. Run: glossa login");
  if (status === 403 && data.error === "account_disabled") {
    return new Error("This Glossa account is disabled.");
  }
  if (status === 403 && data.error === "identity_provider_not_allowed") {
    return new Error(
      "This Glossa identity provider is not allowed. Sign in with Google.",
    );
  }
  if (status === 409 && data.error === "device_name_conflict") {
    return new Error("A Glossa device with this computer name already exists and must be revoked before reenrollment.");
  }
  if (status === 429) return new Error("Glossa device enrollment is rate limited. Try again later.");
  return new Error(`Glossa device enrollment failed with HTTP ${status}.`);
}

export async function accountOwnsDevice(
  endpoints: RelayEndpoints,
  credentials: StoredCredentials,
  deviceId: string,
  fetchRequest: FetchLike = fetch,
): Promise<boolean> {
  const response = await fetchRequest(`${endpoints.relayOrigin}/v1/devices`, {
    headers: {
      authorization: `${credentials.tokenType} ${credentials.accessToken}`,
    },
  });
  let data: DeviceListResponse = {};
  try {
    data = (await response.json()) as DeviceListResponse;
  } catch {
    // Status-specific errors below remain stable for non-JSON proxy responses.
  }
  if (!response.ok) throw enrollmentError(response.status, data);
  if (!Array.isArray(data.devices)) {
    throw new Error("The Glossa relay returned an invalid device list response.");
  }
  if (
    data.devices.some(
      (device) =>
        typeof device.id !== "string" ||
        (device.revokedAt !== null && typeof device.revokedAt !== "string"),
    )
  ) {
    throw new Error("The Glossa relay returned an invalid device list response.");
  }
  return data.devices.some(
    (device) => device.id === deviceId && device.revokedAt === null,
  );
}

export async function enrollDevice(
  endpoints: RelayEndpoints,
  credentials: StoredCredentials,
  deviceName: string,
  fetchRequest: FetchLike = fetch,
): Promise<StoredDeviceCredential> {
  const name = deviceNameSchema.parse(deviceName);
  const response = await fetchRequest(`${endpoints.relayOrigin}/v1/devices/enroll`, {
    method: "POST",
    headers: {
      authorization: `${credentials.tokenType} ${credentials.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, platform: `${process.platform}-${process.arch}` }),
  });
  let data: EnrollmentResponse = {};
  try {
    data = (await response.json()) as EnrollmentResponse;
  } catch {
    // Status-specific errors below remain stable for non-JSON proxy responses.
  }
  if (!response.ok) throw enrollmentError(response.status, data);
  if (
    typeof data.device?.id !== "string" ||
    typeof data.device.name !== "string" ||
    typeof data.device_token !== "string"
  ) {
    throw new Error("The Glossa relay returned an invalid device enrollment response.");
  }
  return {
    relayOrigin: endpoints.relayOrigin,
    deviceId: data.device.id,
    deviceName: data.device.name,
    token: data.device_token,
  };
}
