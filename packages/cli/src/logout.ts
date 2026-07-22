import { loadAuthConfig } from "./auth-config.js";
import {
  deleteCredentials,
  loadCredentials,
  type LoadedCredentials,
} from "./config-store.js";
import { openBrowser } from "./open-browser.js";

export interface LogoutOptions {
  browser: boolean;
}

export interface LogoutDependencies {
  deleteCredentials?: typeof deleteCredentials;
  loadCredentials?: typeof loadCredentials;
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
  const load = dependencies.loadCredentials ?? loadCredentials;
  const browse = dependencies.openBrowser ?? openBrowser;
  const log = dependencies.log ?? console.log;

  let stored: LoadedCredentials | null = null;
  let signedIn = true;
  try {
    stored = await load();
    signedIn = stored !== null;
  } catch {
    // Corrupt credentials stay flagged as present so remove() can clean them up.
  }

  const issuer = dependencies.issuer ?? stored?.credentials.issuer;
  if (signedIn) {
    await remove();
  }
  log(
    signedIn
      ? "Signed out of Glossa locally."
      : "Already signed out of Glossa locally.",
  );
  if (!options.browser) return;

  const url = browserLogoutUrl(issuer ?? loadAuthConfig().issuer);
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
