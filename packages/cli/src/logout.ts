import { loadAuthConfig } from "./auth-config.js";
import { deleteCredentials } from "./config-store.js";
import { openBrowser } from "./open-browser.js";

export interface LogoutOptions {
  browser: boolean;
}

export interface LogoutDependencies {
  deleteCredentials?: typeof deleteCredentials;
  openBrowser?: typeof openBrowser;
  issuer?: string;
  log?: (message: string) => void;
}

export function browserLogoutUrl(issuer: string): string {
  return new URL(
    "v2/logout",
    issuer.endsWith("/") ? issuer : `${issuer}/`,
  ).toString();
}

export async function logoutFromGlossa(
  options: LogoutOptions,
  dependencies: LogoutDependencies = {},
): Promise<void> {
  const remove = dependencies.deleteCredentials ?? deleteCredentials;
  const browse = dependencies.openBrowser ?? openBrowser;
  const issuer = dependencies.issuer ?? loadAuthConfig().issuer;
  const log = dependencies.log ?? console.log;

  await remove();
  log("Signed out of Glossa locally.");
  if (!options.browser) return;

  const url = browserLogoutUrl(issuer);
  const opened = await browse(url);
  if (opened) {
    log("Opened Glossa browser sign-out.");
  } else {
    log("Open this URL to finish signing out in your browser:");
    log(url);
  }
  log(
    "Reconnect Glossa in ChatGPT, then choose the same Google account when the CLI signs in.",
  );
}
