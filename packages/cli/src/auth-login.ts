import {
  SessionExpiredError,
  validCredentials,
} from "./auth-session.js";
import { loadCredentials } from "./config-store.js";
import {
  loginWithDeviceFlow,
  type LoginOptions,
} from "./device-flow.js";

export interface SignInDependencies {
  loadCredentials?: typeof loadCredentials;
  validCredentials?: typeof validCredentials;
  loginWithDeviceFlow?: typeof loginWithDeviceFlow;
}

export async function ensureSignedIn(
  options: LoginOptions,
  dependencies: SignInDependencies = {},
): Promise<void> {
  const load = dependencies.loadCredentials ?? loadCredentials;
  const validate = dependencies.validCredentials ?? validCredentials;
  const login = dependencies.loginWithDeviceFlow ?? loginWithDeviceFlow;
  const loaded = await load();

  if (loaded) {
    try {
      await validate(loaded.credentials);
      return;
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) throw error;
    }
  }

  await login(options);
}
