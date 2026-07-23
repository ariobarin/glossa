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
  glossa --version

Glossa opens one workspace in an interactive terminal.

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

async function loadHudStatus(signal: AbortSignal): Promise<HudStatus> {
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
    devices: devices.map((device) => ({
      id: device.id,
      label: formatDeviceRow(device),
    })),
  };
}

async function revokeHudDevice(deviceId: string): Promise<void> {
  const credentials = await authenticatedCredentials();
  await revokeDevice(loadRelayEndpoints(), credentials, deviceId);
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
    revokeDevice: revokeHudDevice,
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
  } else {
    await runWorkspace(invocation.path);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof UsageError) console.error("Run glossa --help for usage.");
  process.exitCode = 1;
});
