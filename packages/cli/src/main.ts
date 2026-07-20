#!/usr/bin/env node
import { loadCredentials } from "./config-store.js";
import { loadUserProfile } from "./auth-session.js";
import { loadAuthConfig } from "./auth-config.js";
import { ensureSignedIn } from "./auth-login.js";
import { loginWithDeviceFlow } from "./device-flow.js";
import { loadRelayEndpoints } from "./relay-client.js";
import { logoutFromGlossa } from "./logout.js";
import { runManagedSession } from "./worker/managed-session.js";
import { selectExposureRoot } from "./worker/root-selection.js";

declare const __GLOSSA_VERSION__: string;

const VERSION = __GLOSSA_VERSION__;

function usage(): void {
  console.log(`Glossa ${VERSION}

Usage:
  glossa [path] [--allow-broad-root]
  glossa login
  glossa logout [--browser]
  glossa status
  glossa whoami
  glossa --version
  glossa --help

Running Glossa signs in when needed and exposes one local root through the managed MCP relay.`);
}

function exposeOptions(args: string[]): {
  path?: string;
  allowBroadRoot: boolean;
} {
  let selectedPath: string | undefined;
  let allowBroadRoot = false;
  for (const argument of args) {
    if (argument === "--allow-broad-root") allowBroadRoot = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown expose option: ${argument}`);
    else if (selectedPath) throw new Error("Expose accepts at most one directory.");
    else selectedPath = argument;
  }
  return {
    ...(selectedPath ? { path: selectedPath } : {}),
    allowBroadRoot,
  };
}

function logoutOptions(args: string[]): { browser: boolean } {
  const options = args.slice(1);
  if (options.length === 0) return { browser: false };
  if (options.length === 1 && options[0] === "--browser") {
    return { browser: true };
  }
  throw new Error("Logout accepts only --browser.");
}

async function runExposure(args: string[]): Promise<void> {
  const options = exposeOptions(args);
  const root = await selectExposureRoot(options.path, options.allowBroadRoot);
  await withLoginSignal(async (signal) => {
    await ensureSignedIn({
      ...loadAuthConfig(),
      signal,
    });
  });
  await runManagedSession(root, loadRelayEndpoints(), options.allowBroadRoot);
}

async function withLoginSignal(
  action: (signal: AbortSignal) => Promise<void>,
): Promise<void> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    await action(controller.signal);
  } finally {
    process.removeListener("SIGINT", cancel);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command] = args;

  if (
    !command ||
    (command.startsWith("-") &&
      !["--help", "-h", "--version", "-v"].includes(command))
  ) {
    await runExposure(args);
    return;
  }

  switch (command) {
    case "--help":
    case "-h":
    case "help":
      usage();
      return;
    case "--version":
    case "-v":
      console.log(VERSION);
      return;
    case "login":
      await withLoginSignal(async (signal) => {
        await loginWithDeviceFlow({
          ...loadAuthConfig(),
          signal,
        });
      });
      return;
    case "logout":
      await logoutFromGlossa(logoutOptions(args));
      return;
    case "status": {
      const loaded = await loadCredentials();
      if (!loaded) {
        console.log("Not signed in. Run Glossa to sign in and connect a workspace.");
        process.exitCode = 1;
        return;
      }
      console.log(
        `Signed in with ${loaded.backend} credentials; access token expires ${loaded.credentials.expiresAt}.`,
      );
      return;
    }
    case "whoami": {
      const loaded = await loadCredentials();
      if (!loaded) {
        console.log("Not signed in. Run Glossa to sign in and connect a workspace.");
        process.exitCode = 1;
        return;
      }
      const { credentials, profile } = await loadUserProfile(loaded.credentials);
      const account = profile.email ?? profile.name ?? profile.sub;
      console.log(
        `Signed in as ${account} (${profile.sub}); access token expires ${credentials.expiresAt}.`,
      );
      return;
    }
    default:
      {
        await runExposure(args);
        return;
      }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
