#!/usr/bin/env node
import { deleteCredentials, loadCredentials } from "./config-store.js";
import { loadUserProfile } from "./auth-session.js";
import { loadAuthConfig } from "./auth-config.js";
import { loginWithDeviceFlow } from "./device-flow.js";
import { loadRelayEndpoints } from "./relay-client.js";
import { runLocalSession } from "./worker/local-session.js";
import { runManagedSession } from "./worker/managed-session.js";
import { selectExposureRoot } from "./worker/root-selection.js";

const VERSION = "0.1.0-beta.3";

function usage(): void {
  console.log(`Glossa ${VERSION}

Usage:
  glossa [path] [--allow-broad-root]
  glossa login
  glossa logout
  glossa status
  glossa whoami
  glossa [path] --local [--allow-broad-root]
  glossa --version
  glossa --help

Running Glossa exposes one local root through the managed MCP relay.
Local mode reads newline-delimited worker jobs from stdin and writes results to stdout.`);
}

function exposeOptions(args: string[]): {
  path?: string;
  local: boolean;
  allowBroadRoot: boolean;
} {
  let selectedPath: string | undefined;
  let local = false;
  let allowBroadRoot = false;
  for (const argument of args) {
    if (argument === "--local") local = true;
    else if (argument === "--allow-broad-root") allowBroadRoot = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown expose option: ${argument}`);
    else if (selectedPath) throw new Error("Expose accepts at most one directory.");
    else selectedPath = argument;
  }
  return {
    ...(selectedPath ? { path: selectedPath } : {}),
    local,
    allowBroadRoot,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command] = args;

  if (
    !command ||
    (command.startsWith("-") &&
      !["--help", "-h", "--version", "-v"].includes(command))
  ) {
    const options = exposeOptions(args);
    const root = await selectExposureRoot(options.path, options.allowBroadRoot);
    if (options.local) await runLocalSession(root, options.allowBroadRoot);
    else
      await runManagedSession(
        root,
        loadRelayEndpoints(),
        options.allowBroadRoot,
      );
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
      {
        const authConfig = loadAuthConfig();
        const controller = new AbortController();
        const cancel = () => controller.abort();
        process.once("SIGINT", cancel);
        try {
          await loginWithDeviceFlow({
            ...authConfig,
            signal: controller.signal,
          });
        } finally {
          process.removeListener("SIGINT", cancel);
        }
      }
      return;
    case "logout":
      await deleteCredentials();
      console.log("Signed out of Glossa.");
      return;
    case "status": {
      const loaded = await loadCredentials();
      if (!loaded) {
        console.log("Not signed in. Run: glossa login");
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
        console.log("Not signed in. Run: glossa login");
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
        const options = exposeOptions(args);
        const root = await selectExposureRoot(options.path, options.allowBroadRoot);
        if (options.local) await runLocalSession(root, options.allowBroadRoot);
        else
          await runManagedSession(
            root,
            loadRelayEndpoints(),
            options.allowBroadRoot,
          );
        return;
      }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
