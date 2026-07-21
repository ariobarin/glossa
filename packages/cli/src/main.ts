#!/usr/bin/env node
import { validCredentials } from "./auth-session.js";
import { loadUserProfile } from "./auth-session.js";
import { loadAuthConfig } from "./auth-config.js";
import { ensureSignedIn } from "./auth-login.js";
import { parseInvocation, UsageError, type HelpTopic } from "./cli-options.js";
import { loadCredentials, type StoredCredentials } from "./config-store.js";
import {
  listDevices,
  loadRelayEndpoints,
  renameDevice,
  revokeDevice,
  type RelayDevice,
} from "./relay-client.js";
import { logoutFromGlossa } from "./logout.js";
import { runManagedSession } from "./worker/managed-session.js";
import { selectExposureRoot } from "./worker/root-selection.js";

declare const __GLOSSA_VERSION__: string;

const VERSION = __GLOSSA_VERSION__;

const helpText: Record<HelpTopic | "main", string> = {
  main: `Glossa ${VERSION}

Usage:
  glossa
  glossa [directory]
  glossa start [directory] [--allow-broad-root]
  glossa status [--json]
  glossa devices list [--json]
  glossa devices rename <id> <name>
  glossa devices revoke <id>
  glossa login
  glossa logout [--browser]
  glossa --version
  glossa --help

Glossa signs in automatically and exposes each started workspace through the managed MCP relay.`,
  start: `Usage: glossa start [directory] [--allow-broad-root]

Starts a foreground worker. Inside Git, the default directory is the worktree root.
Outside Git, provide a directory. Press Ctrl+C to disconnect.`,
  status: `Usage: glossa status [--json]

Validates Google login, contacts the relay, and reports enrolled devices and active workers.`,
  devices: `Usage:
  glossa devices list [--json]
  glossa devices rename <id> <name>
  glossa devices revoke <id>

Lists, renames, or revokes computers enrolled with the current Google account.`,
  login: `Usage: glossa login

Ensures the CLI has a valid Google session. Starting Glossa also signs in automatically.`,
  logout: `Usage: glossa logout [--browser]

Removes local OAuth credentials. --browser also opens the browser-session logout used when switching Google accounts. Running workers remain connected until stopped or revoked.`,
};

async function withLoginSignal<T>(
  action: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    return await action(controller.signal);
  } finally {
    process.removeListener("SIGINT", cancel);
  }
}

async function authenticatedCredentials(): Promise<{
  credentials: StoredCredentials;
  loginPerformed: boolean;
}> {
  const loginPerformed = await withLoginSignal(async (signal) => {
    return await ensureSignedIn({ ...loadAuthConfig(), signal });
  });
  const loaded = await loadCredentials();
  if (!loaded) throw new Error("Glossa could not load the completed login.");
  return {
    credentials: await validCredentials(loaded.credentials),
    loginPerformed,
  };
}

async function runExposure(path: string | undefined, allowBroadRoot: boolean): Promise<void> {
  const root = await selectExposureRoot(path, allowBroadRoot);
  await authenticatedCredentials();
  await runManagedSession(root, loadRelayEndpoints(), allowBroadRoot);
}

function deviceStatus(device: RelayDevice): string {
  if (device.revokedAt) return "revoked";
  if (device.activeWorkers === null) return "worker count unavailable";
  if (device.activeWorkers === 0) return "offline";
  return `${device.activeWorkers} active ${device.activeWorkers === 1 ? "worker" : "workers"}`;
}

async function showStatus(json: boolean): Promise<void> {
  const { credentials: initial } = await authenticatedCredentials();
  const { credentials, profile } = await loadUserProfile(initial);
  const endpoints = loadRelayEndpoints();
  const devices = await listDevices(endpoints, credentials);
  const account = profile.email ?? profile.name ?? profile.sub;
  const workerCountsCurrent = devices.every((device) => device.activeWorkers !== null);
  const activeWorkers = workerCountsCurrent
    ? devices.reduce((sum, device) => sum + device.activeWorkers!, 0)
    : null;
  const result = {
    account,
    relay: endpoints.relayOrigin,
    connected: true,
    activeWorkers,
    devices,
  };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Signed in as ${account}.`);
  console.log(`Relay connected: ${endpoints.relayOrigin}`);
  console.log(
    activeWorkers === null
      ? "Active workers: unavailable until the relay is updated"
      : `Active workers: ${activeWorkers}`,
  );
  if (devices.length === 0) {
    console.log("No devices enrolled. Run glossa start in a workspace.");
    return;
  }
  for (const device of devices) {
    console.log(`${device.id}  ${device.name}  ${deviceStatus(device)}`);
  }
}

async function deviceCredentials(): Promise<{
  credentials: StoredCredentials;
  endpoints: ReturnType<typeof loadRelayEndpoints>;
}> {
  return {
    credentials: (await authenticatedCredentials()).credentials,
    endpoints: loadRelayEndpoints(),
  };
}

async function main(): Promise<void> {
  const invocation = parseInvocation(process.argv.slice(2));
  if (invocation.command === "help") {
    console.log(helpText[invocation.topic ?? "main"]);
  } else if (invocation.command === "version") {
    console.log(VERSION);
  } else if (invocation.command === "start") {
    await runExposure(invocation.path, invocation.allowBroadRoot);
  } else if (invocation.command === "status") {
    await showStatus(invocation.json);
  } else if (invocation.command === "login") {
    const { loginPerformed } = await authenticatedCredentials();
    if (!loginPerformed) console.log("Signed in to Glossa.");
  } else if (invocation.command === "logout") {
    await logoutFromGlossa({ browser: invocation.browser });
  } else if (invocation.action === "list") {
    const { endpoints, credentials } = await deviceCredentials();
    const devices = await listDevices(endpoints, credentials);
    if (invocation.json) console.log(JSON.stringify({ devices }, null, 2));
    else if (devices.length === 0) console.log("No devices enrolled.");
    else for (const device of devices) console.log(`${device.id}  ${device.name}  ${deviceStatus(device)}`);
  } else if (invocation.action === "rename") {
    const { endpoints, credentials } = await deviceCredentials();
    const device = await renameDevice(endpoints, credentials, invocation.deviceId, invocation.name);
    console.log(`Renamed device ${device.id} to ${device.name}.`);
  } else {
    const { endpoints, credentials } = await deviceCredentials();
    await revokeDevice(endpoints, credentials, invocation.deviceId);
    console.log(`Revoked device ${invocation.deviceId}. Running workers on it are disconnected.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof UsageError) console.error("Run glossa --help for usage.");
  process.exitCode = 1;
});
