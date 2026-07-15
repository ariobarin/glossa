import {
  SessionExpiredError,
  validCredentials,
} from "./auth-session.js";
import {
  loadCredentials,
  type StoredCredentials,
} from "./config-store.js";
import {
  loginWithDeviceFlow,
  type LoginOptions,
} from "./device-flow.js";

export interface SignInDependencies {
  loadCredentials?: typeof loadCredentials;
  validCredentials?: typeof validCredentials;
  loginWithDeviceFlow?: typeof loginWithDeviceFlow;
}

function normalizedIssuer(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizedScopes(value: string | undefined): string[] {
  return [...new Set(value?.trim().split(/\s+/).filter(Boolean) ?? [])].sort();
}

export function credentialsMatchLoginOptions(
  credentials: StoredCredentials,
  options: LoginOptions,
): boolean {
  return (
    normalizedIssuer(credentials.issuer) === normalizedIssuer(options.issuer) &&
    credentials.clientId === options.clientId &&
    credentials.audience === options.audience &&
    JSON.stringify(normalizedScopes(credentials.scope)) ===
      JSON.stringify(normalizedScopes(options.scope))
  );
}

export async function ensureSignedIn(
  options: LoginOptions,
  dependencies: SignInDependencies = {},
): Promise<void> {
  const load = dependencies.loadCredentials ?? loadCredentials;
  const validate = dependencies.validCredentials ?? validCredentials;
  const login = dependencies.loginWithDeviceFlow ?? loginWithDeviceFlow;
  const loaded = await load();

  if (loaded && credentialsMatchLoginOptions(loaded.credentials, options)) {
    try {
      await validate(loaded.credentials);
      return;
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) throw error;
    }
  }

  await login(options);
}
