#!/usr/bin/env node
import { deleteCredentials, loadCredentials } from "./config-store.js";
import { loginWithDeviceFlow } from "./device-flow.js";

const VERSION = "prototype";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required in this implementation scaffold.`);
  return value;
}

function usage(): void {
  console.log(`Glossa ${VERSION}

Usage:
  glossa login
  glossa logout
  glossa status
  glossa whoami
  glossa expose [path]
  glossa --version
  glossa --help

The expose worker is implemented during milestone M1.`);
}

async function main(): Promise<void> {
  const [command = "help"] = process.argv.slice(2);

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
      await loginWithDeviceFlow({
        issuer: requiredEnvironment("GLOSSA_AUTH0_ISSUER"),
        clientId: requiredEnvironment("GLOSSA_AUTH0_CLI_CLIENT_ID"),
        audience: requiredEnvironment("GLOSSA_AUTH0_AUDIENCE"),
        scope: "openid profile offline_access glossa:device",
      });
      return;
    case "logout":
      await deleteCredentials();
      console.log("Signed out of Glossa.");
      return;
    case "status":
    case "whoami": {
      const credentials = await loadCredentials();
      if (!credentials) {
        console.log("Not signed in. Run: glossa login");
        process.exitCode = 1;
        return;
      }
      console.log(`Signed in; access token expires ${credentials.expiresAt}.`);
      return;
    }
    case "expose":
      throw new Error(
        "The worker is not yet implemented in this scaffold. Complete milestone M1 before using glossa expose.",
      );
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
