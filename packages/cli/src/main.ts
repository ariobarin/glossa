#!/usr/bin/env node
import { validCredentials } from "./auth-session.js";
import { loadUserProfile } from "./auth-session.js";
import { loadAuthConfig } from "./auth-config.js";
import { ensureSignedIn } from "./auth-login.js";
import { parseInvocation, UsageError, type HelpTopic } from "./cli-options.js";
import { loadCredentials, type StoredCredentials } from "./config-store.js";
import { completionScript } from "./completions.js";
import { runDoctor } from "./doctor.js";
import {
  listDevices,
  loadRelayEndpoints,
  renameDevice,
  revokeDevice,
} from "./relay-client.js";
import { formatDeviceRow } from "./device-format.js";
import { logoutFromGlossa } from "./logout.js";
import { noActiveWorkerHint } from "./status-guidance.js";
import { updateGlossa } from "./update.js";
import { runSessionHud } from "./ui-hud.js";
import { runManagedSession } from "./worker/managed-session.js";
import { selectExposureRoot } from "./worker/root-selection.js";

declare const __GLOSSA_VERSION__: string;

const VERSION = __GLOSSA_VERSION__;

const helpText: Record<HelpTopic | "main", string> = {
  main: `Glossa ${VERSION}

Usage:
  glossa
  glossa [directory]
  glossa ui [directory] [--allow-broad-root] [--device-name <name>]
  glossa start [directory] [--allow-broad-root] [--device-name <name>]
  glossa status [--json]
  glossa doctor [--json]
  glossa devices list [--json]
  glossa devices rename <id> <name>
  glossa devices revoke <id>
  glossa completions <shell>
  glossa update
  glossa login
  glossa logout [--browser]
  glossa --version
  glossa --help

Glossa signs in automatically and exposes each started workspace through the managed MCP relay.`,
  ui: `Usage: glossa ui [directory] [--allow-broad-root] [--device-name <name>]

Opens an experimental compact session HUD for the current workspace.
It starts immediately, shows connection and activity, and exits with q or Ctrl+C. --device-name names this computer on first enrollment.`,
  start: `Usage: glossa start [directory] [--allow-broad-root] [--device-name <name>]

Starts a foreground worker. Inside Git, the default directory is the worktree root.
Outside Git, the current directory is used. --device-name names this computer the first time it enrolls; once enrolled the name is reused. Press Ctrl+C to disconnect.`,
  status: `Usage: glossa status [--json]

Validates Google login, contacts the relay, and reports enrolled devices and active workers.`,
  doctor: `Usage: glossa doctor [--json]

Checks Node.js, relay and worker reachability, and read-only sign-in state, then reports whether Glossa is ready to start.`,
  devices: `Usage:
  glossa devices list [--json]
  glossa devices rename <id> <name>
  glossa devices revoke <id>

Lists, renames, or revokes computers enrolled with the current Google account.`,
  completions: `Usage: glossa completions <shell>

Prints a completion script for powershell, bash, zsh, or fish. Source it from your shell profile, for example: glossa completions powershell | Out-String | Invoke-Expression.`,
  update: `Usage: glossa update

Updates the global Glossa installation from the npm beta channel. glossa upgrade is an alias.`,
  login: `Usage: glossa login

Ensures the CLI has a valid Google session. Starting Glossa also signs in automatically.`,
  logout: `Usage: glossa logout [--browser]

Removes local OAuth credentials. --browser also opens the browser-session logout used when switching Google accounts. Running workers remain connected until stopped or revoked.`,
};

async function withLoginSignal<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    return await action(controller.signal);
  } finally {
    process.removeListener("SIGINT", cancel);
  }
}

async function authenticatedCredentials(signal?: AbortSignal): Promise<{
  credentials: StoredCredentials;
  loginPerformed: boolean;
}> {
  const loginPerformed = signal
    ? await ensureSignedIn({ ...loadAuthConfig(), signal })
    : await withLoginSignal(async (loginSignal) => {
        return await ensureSignedIn({ ...loadAuthConfig(), signal: loginSignal });
      });
  const loaded = await loadCredentials();
  if (!loaded) throw new Error("Glossa could not load the completed login.");
  return {
    credentials: await validCredentials(
      loaded.credentials,
      signal ? { signal } : {},
    ),
    loginPerformed,
  };
}

async function runExposure(
  path: string | undefined,
  allowBroadRoot: boolean,
  deviceName?: string,
): Promise<void> {
  const root = await selectExposureRoot(path, allowBroadRoot);
  await authenticatedCredentials();
  await runManagedSession(root, loadRelayEndpoints(), allowBroadRoot, {
    ...(deviceName ? { deviceName } : {}),
  });
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
  const hint = noActiveWorkerHint(activeWorkers, devices.length);
  if (hint) console.log(hint);
  for (const device of devices) {
    console.log(formatDeviceRow(device));
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

async function showDevices(json: boolean): Promise<void> {
  const { endpoints, credentials } = await deviceCredentials();
  const devices = await listDevices(endpoints, credentials);
  if (json) console.log(JSON.stringify({ devices }, null, 2));
  else if (devices.length === 0) console.log("No devices enrolled.");
  else for (const device of devices) console.log(formatDeviceRow(device));
}

async function runInteractive(
  path: string | undefined,
  allowBroadRoot: boolean,
  deviceName?: string,
): Promise<void> {
  const root = await selectExposureRoot(path, allowBroadRoot);
  await runSessionHud({
    workspace: root,
    run: async (signal, onEvent) => {
      await authenticatedCredentials(signal);
      await runManagedSession(root, loadRelayEndpoints(), allowBroadRoot, {
        signal,
        onEvent,
        quiet: true,
        handleProcessSignals: false,
        ...(deviceName ? { deviceName } : {}),
      });
    },
  });
}

async function main(): Promise<void> {
  const invocation = parseInvocation(process.argv.slice(2));
  if (invocation.command === "help") {
    console.log(helpText[invocation.topic ?? "main"]);
  } else if (invocation.command === "version") {
    console.log(VERSION);
  } else if (invocation.command === "ui") {
    await runInteractive(invocation.path, invocation.allowBroadRoot, invocation.deviceName);
  } else if (invocation.command === "start") {
    await runExposure(invocation.path, invocation.allowBroadRoot, invocation.deviceName);
  } else if (invocation.command === "status") {
    await showStatus(invocation.json);
  } else if (invocation.command === "doctor") {
    const ok = await runDoctor(invocation.json);
    if (!ok) process.exitCode = 1;
  } else if (invocation.command === "login") {
    const { loginPerformed } = await authenticatedCredentials();
    if (!loginPerformed) console.log("Signed in to Glossa.");
  } else if (invocation.command === "logout") {
    await logoutFromGlossa({ browser: invocation.browser });
  } else if (invocation.command === "completions") {
    console.log(completionScript(invocation.shell));
  } else if (invocation.command === "update") {
    updateGlossa();
  } else if (invocation.action === "list") {
    await showDevices(invocation.json);
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
