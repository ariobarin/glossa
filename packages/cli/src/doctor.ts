import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadCredentials } from "./config-store.js";
import {
  loadRelayEndpoints,
  type RelayEndpoints,
} from "./relay-client.js";

const execFileAsync = promisify(execFile);

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

export interface DoctorDependencies {
  nodeVersion?: string;
  endpoints?: RelayEndpoints;
  checkGit?: () => Promise<boolean>;
  fetchHealthz?: (origin: string) => Promise<boolean>;
  hasCredentials?: () => Promise<boolean>;
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
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const nodeOk = nodeVersionSatisfies(nodeVersion);
  const checks: DoctorCheck[] = [
    {
      name: "Node.js",
      status: nodeOk ? "pass" : "fail",
      detail: `Node.js v${nodeVersion}`,
      ...(nodeOk ? {} : { nextStep: `Install Node.js ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} or newer and restart your terminal.` }),
    },
  ];

  const checkGit = dependencies.checkGit ?? defaultCheckGit;
  const gitOk = await checkGit();
  checks.push({
    name: "Git",
    status: gitOk ? "pass" : "fail",
    detail: gitOk ? "Git is installed." : "Git was not found.",
    ...(gitOk ? {} : { nextStep: "Install Git from https://git-scm.com/ and restart your terminal." }),
  });

  const endpoints = dependencies.endpoints ?? loadRelayEndpoints();
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

  const hasCredentials = dependencies.hasCredentials ?? defaultHasCredentials;
  const signedIn = await hasCredentials();
  checks.push({
    name: "Sign-in",
    status: signedIn ? "pass" : "warn",
    detail: signedIn ? "Signed in to Glossa." : "Not signed in yet.",
    ...(signedIn ? {} : { nextStep: 'Run "glossa" inside a workspace. Sign-in opens automatically.' }),
  });

  return checks;
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

async function defaultCheckGit(): Promise<boolean> {
  try {
    await execFileAsync("git", ["--version"], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
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

async function defaultHasCredentials(): Promise<boolean> {
  try {
    return (await loadCredentials()) !== null;
  } catch {
    return false;
  }
}
