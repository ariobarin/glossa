#!/usr/bin/env node
import { validCredentials } from "./auth-session.js";
import { loadUserProfile } from "./auth-session.js";
import { loadAuthConfig } from "./auth-config.js";
import { ensureSignedIn } from "./auth-login.js";
import { parseInvocation, UsageError } from "./cli-options.js";
import { loadCredentials, type StoredCredentials } from "./config-store.js";
import { formatDeviceRow } from "./device-format.js";
import { logoutFromGlossa } from "./logout.js";
import {
  listDevices,
  loadRelayEndpoints,
  revokeDevice,
  type RelayDevice,
} from "./relay-client.js";
import { runSessionHud, type HudStatus } from "./ui-hud.js";
import { updateGlossa } from "./update.js";
import { runManagedSession } from "./worker/managed-session.js";
import { selectExposureRoot } from "./worker/root-selection.js";

declare const __GLOSSA_VERSION__: string;

const VERSION = __GLOSSA_VERSION__;

const HELP = `Glossa ${VERSION}

Usage:
  glossa [directory]
  glossa status [--json]
  glossa devices [--json]
  glossa devices revoke <id>
  glossa update
  glossa login
  glossa logout
  glossa --version

Running glossa opens one workspace in an interactive terminal.
Direct commands remain available for scripts and quick checks.

Keys:
  d  recent activity
  s  account and devices
  r  revoke a device
  l  sign out
  u  update Glossa
  ?  show all keys
  q or Ctrl+C  disconnect and quit`;

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

async function authenticatedCredentials(
  signal?: AbortSignal,
): Promise<StoredCredentials> {
  if (signal) await ensureSignedIn({ ...loadAuthConfig(), signal });
  else {
    await withLoginSignal(async (loginSignal) => {
      await ensureSignedIn({ ...loadAuthConfig(), signal: loginSignal });
    });
  }
  const loaded = await loadCredentials();
  if (!loaded) throw new Error("Glossa could not load the completed login.");
  return await validCredentials(
    loaded.credentials,
    signal ? { signal } : {},
  );
}

interface StatusDetails {
  account: string;
  relay: string;
  activeWorkers: number | null;
  devices: RelayDevice[];
}

async function loadStatusDetails(signal?: AbortSignal): Promise<StatusDetails> {
  const initial = await authenticatedCredentials(signal);
  const { credentials, profile } = await loadUserProfile(initial);
  const endpoints = loadRelayEndpoints();
  const devices = await listDevices(endpoints, credentials);
  const workerCountsCurrent = devices.every(
    (device) => device.activeWorkers !== null,
  );
  return {
    account: profile.email ?? profile.name ?? profile.sub,
    relay: endpoints.relayOrigin,
    activeWorkers: workerCountsCurrent
      ? devices.reduce((sum, device) => sum + device.activeWorkers!, 0)
      : null,
    devices,
  };
}

async function loadHudStatus(signal: AbortSignal): Promise<HudStatus> {
  const status = await loadStatusDetails(signal);
  return {
    ...status,
    devices: status.devices.map((device) => ({
      id: device.id,
      label: formatDeviceRow(device),
    })),
  };
}

async function revokeKnownDevice(deviceId: string): Promise<void> {
  const credentials = await authenticatedCredentials();
  await revokeDevice(loadRelayEndpoints(), credentials, deviceId);
}

async function showStatus(json: boolean): Promise<void> {
  const status = await loadStatusDetails();
  if (json) {
    console.log(JSON.stringify({ ...status, connected: true }, null, 2));
    return;
  }
  console.log(`Signed in as ${status.account}.`);
  console.log(`Relay connected: ${status.relay}`);
  console.log(
    status.activeWorkers === null
      ? "Active workspaces: unavailable"
      : `Active workspaces: ${status.activeWorkers}`,
  );
  if (status.devices.length === 0) {
    console.log("No devices enrolled.");
  } else {
    for (const device of status.devices) console.log(formatDeviceRow(device));
  }
}

async function showDevices(json: boolean): Promise<void> {
  const credentials = await authenticatedCredentials();
  const devices = await listDevices(loadRelayEndpoints(), credentials);
  if (json) console.log(JSON.stringify({ devices }, null, 2));
  else if (devices.length === 0) console.log("No devices enrolled.");
  else for (const device of devices) console.log(formatDeviceRow(device));
}

async function runWorkspace(
  path: string | undefined,
): Promise<void> {
  const root = await selectExposureRoot(path);
  const exitAction = await runSessionHud({
    workspace: root,
    run: async (signal, onEvent) => {
      await authenticatedCredentials(signal);
      await runManagedSession(root, loadRelayEndpoints(), {
        signal,
        onEvent,
        quiet: true,
        handleProcessSignals: false,
      });
    },
    loadStatus: loadHudStatus,
    revokeDevice: revokeKnownDevice,
  });

  if (exitAction === "logout") await logoutFromGlossa();
  else if (exitAction === "update") updateGlossa();
}

async function main(): Promise<void> {
  const invocation = parseInvocation(process.argv.slice(2));
  if (invocation.command === "help") {
    console.log(HELP);
  } else if (invocation.command === "version") {
    console.log(VERSION);
  } else if (invocation.command === "workspace") {
    await runWorkspace(invocation.path);
  } else if (invocation.command === "status") {
    await showStatus(invocation.json);
  } else if (invocation.command === "login") {
    await authenticatedCredentials();
    console.log("Signed in to Glossa.");
  } else if (invocation.command === "logout") {
    await logoutFromGlossa();
  } else if (invocation.command === "update") {
    updateGlossa();
  } else if (invocation.action === "list") {
    await showDevices(invocation.json);
  } else {
    await revokeKnownDevice(invocation.deviceId);
    console.log(`Revoked device ${invocation.deviceId}. Running workspaces on it are disconnected.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof UsageError) console.error("Run glossa --help for usage.");
  process.exitCode = 1;
});
