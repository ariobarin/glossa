import { peekCredentials } from "./config-store.js";
import { peekDeviceCredential } from "./device-store.js";
import {
  loadRelayEndpoints,
  type RelayEndpoints,
} from "./relay-client.js";
import { isStandaloneExecutable } from "./runtime.js";

export const MIN_NODE_MAJOR = 22;
export const MIN_NODE_MINOR = 9;
const HEALTHZ_TIMEOUT_MS = 5_000;

export type CheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
  nextStep?: string;
}

export type CredentialProbe = "present" | "absent" | "error";

export interface DoctorDependencies {
  nodeVersion?: string;
  standalone?: boolean;
  probeStandaloneRuntime?: () => Promise<boolean>;
  endpoints?: RelayEndpoints;
  loadEndpoints?: () => RelayEndpoints;
  fetchHealthz?: (origin: string) => Promise<boolean>;
  probeCredentials?: () => Promise<CredentialProbe>;
  probeDeviceCredential?: () => Promise<CredentialProbe>;
}

export function nodeVersionSatisfies(version: string): boolean {
  const match = /^v?(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isInteger(major) || !Number.isInteger(minor)) return false;
  return (
    major > MIN_NODE_MAJOR ||
    (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)
  );
}

export async function runDoctorChecks(
  dependencies: DoctorDependencies = {},
): Promise<DoctorCheck[]> {
  const standalone =
    dependencies.standalone ?? isStandaloneExecutable();
  const checks: DoctorCheck[] = [];
  if (standalone) {
    const runtimeReady = await (
      dependencies.probeStandaloneRuntime ?? defaultProbeStandaloneRuntime
    )();
    checks.push({
      name: "Runtime",
      status: runtimeReady ? "pass" : "fail",
      detail: runtimeReady
        ? "Self-contained Glossa executable."
        : "The executable is missing its native credential module.",
      ...(runtimeReady
        ? {}
        : { nextStep: "Reinstall Glossa with npm or the direct installer." }),
    });
  } else {
    const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
    const nodeOk = nodeVersionSatisfies(nodeVersion);
    const displayedNodeVersion = nodeVersion.startsWith("v") ? nodeVersion : `v${nodeVersion}`;
    checks.push({
      name: "Node.js",
      status: nodeOk ? "pass" : "fail",
      detail: `Node.js ${displayedNodeVersion}`,
      ...(nodeOk ? {} : { nextStep: `Install Node.js ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} or newer and restart your terminal.` }),
    });
  }

  let endpoints = dependencies.endpoints;
  if (!endpoints) {
    try {
      endpoints = (dependencies.loadEndpoints ?? loadRelayEndpoints)();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: "Relay",
        status: "fail",
        detail: `Endpoint configuration is invalid: ${message}`,
        nextStep: "Set GLOSSA_RELAY_ORIGIN and GLOSSA_WORKER_ORIGIN to origin URLs only, without paths.",
      });
    }
  }

  if (endpoints) {
    const fetchHealthz = dependencies.fetchHealthz ?? defaultFetchHealthz;
    const relayOk = await fetchHealthz(endpoints.relayOrigin);
    checks.push({
      name: "Relay",
      status: relayOk ? "pass" : "fail",
      detail: relayOk
        ? `${endpoints.relayOrigin} is reachable.`
        : `${endpoints.relayOrigin} is not reachable.`,
      ...(relayOk ? {} : { nextStep: "Check your internet connection. If you self-host, confirm GLOSSA_RELAY_ORIGIN." }),
    });

    if (endpoints.workerOrigin !== endpoints.relayOrigin) {
      const workerOk = await fetchHealthz(endpoints.workerOrigin);
      checks.push({
        name: "Worker",
        status: workerOk ? "pass" : "fail",
        detail: workerOk
          ? `${endpoints.workerOrigin} is reachable.`
          : `${endpoints.workerOrigin} is not reachable.`,
        ...(workerOk ? {} : { nextStep: "Confirm GLOSSA_WORKER_ORIGIN and the worker endpoint reverse proxy." }),
      });
    }
  }

  const probeCredentials = dependencies.probeCredentials ?? defaultProbeCredentials;
  const credentialState = await probeCredentials();
  checks.push(signInCheck(credentialState));

  const probeDeviceCredential =
    dependencies.probeDeviceCredential ?? defaultProbeDeviceCredential;
  const deviceCredentialState = await probeDeviceCredential();
  checks.push(deviceCredentialCheck(deviceCredentialState));

  return checks;
}

async function defaultProbeStandaloneRuntime(): Promise<boolean> {
  try {
    const keyring = await import("@napi-rs/keyring");
    return typeof keyring.AsyncEntry === "function";
  } catch {
    return false;
  }
}

function signInCheck(state: CredentialProbe): DoctorCheck {
  if (state === "present") {
    return { name: "Sign-in", status: "pass", detail: "Signed in to Glossa." };
  }
  if (state === "absent") {
    return {
      name: "Sign-in",
      status: "warn",
      detail: "Not signed in yet.",
      nextStep: 'Run "glossa" inside a workspace. Sign-in opens automatically.',
    };
  }
  return {
    name: "Sign-in",
    status: "fail",
    detail: "Stored credentials are unreadable.",
    nextStep: 'Run "glossa logout" to clear them, then start Glossa again.',
  };
}

function deviceCredentialCheck(state: CredentialProbe): DoctorCheck {
  if (state === "present") {
    return {
      name: "Device",
      status: "pass",
      detail: "Device credentials are readable.",
    };
  }
  if (state === "absent") {
    return {
      name: "Device",
      status: "warn",
      detail: "No device is enrolled on this computer yet.",
      nextStep: 'Run "glossa --device-name <name> ." inside a workspace to enroll it.',
    };
  }
  return {
    name: "Device",
    status: "fail",
    detail: "Stored device credentials are unreadable.",
    nextStep:
      "Remove the local Glossa device credential from the operating-system credential store (or the device.json fallback), then start Glossa again to re-enroll.",
  };
}

export function formatDoctorResult(checks: DoctorCheck[], json: boolean): string {
  if (json) return JSON.stringify({ checks }, null, 2);
  const nameWidth = Math.max(...checks.map((check) => check.name.length));
  const lines: string[] = ["Glossa doctor", ""];
  for (const check of checks) {
    const name = check.name.padEnd(nameWidth);
    lines.push(`  ${name}  ${check.status.toUpperCase()}  ${check.detail}`);
    if (check.nextStep) {
      lines.push(`  ${" ".repeat(nameWidth)}  ${check.nextStep}`);
    }
  }
  const failed = checks.filter((check) => check.status === "fail").length;
  lines.push("");
  lines.push(
    failed === 0
      ? "Glossa is ready to start."
      : `${failed} check${failed === 1 ? "" : "s"} failed. Resolve the items above before starting.`,
  );
  return lines.join("\n");
}

export async function runDoctor(
  json: boolean,
  dependencies: DoctorDependencies = {},
  log: (message: string) => void = console.log,
): Promise<boolean> {
  const checks = await runDoctorChecks(dependencies);
  log(formatDoctorResult(checks, json));
  return checks.every((check) => check.status !== "fail");
}

async function defaultFetchHealthz(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/healthz`, {
      signal: AbortSignal.timeout(HEALTHZ_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { ok?: unknown; service?: unknown };
    return data.ok === true && data.service === "glossa-relay";
  } catch {
    return false;
  }
}

async function defaultProbeCredentials(): Promise<CredentialProbe> {
  try {
    return (await peekCredentials()) !== null ? "present" : "absent";
  } catch {
    // A malformed credential store would also break glossa start/status, so
    // surface it as a failure rather than masking it as "not signed in".
    return "error";
  }
}

async function defaultProbeDeviceCredential(): Promise<CredentialProbe> {
  try {
    return (await peekDeviceCredential()) !== null ? "present" : "absent";
  } catch {
    // Startup consumes this credential, so malformed local state must make
    // doctor fail instead of declaring the machine ready.
    return "error";
  }
}
