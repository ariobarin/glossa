import {
  deleteCredentials,
  saveCredentials,
  type StoredCredentials,
} from "./config-store.js";

const EXPIRY_BUFFER_MS = 60_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface OAuthError {
  error: string;
  error_description?: string;
}

export interface UserProfile {
  sub: string;
  name?: string;
  email?: string;
}

export interface AuthSessionDependencies {
  fetch?: FetchLike;
  saveCredentials?: typeof saveCredentials;
  deleteCredentials?: typeof deleteCredentials;
  now?: () => number;
}

function endpoint(issuer: string, pathname: string): string {
  return new URL(pathname, issuer.endsWith("/") ? issuer : `${issuer}/`).toString();
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired. Run Glossa again to sign in.");
    this.name = "SessionExpiredError";
  }
}

function sessionExpiredError(): SessionExpiredError {
  return new SessionExpiredError();
}

function oauthMessage(data: OAuthError, status: number): string {
  return data.error_description ?? data.error ?? `HTTP ${status}`;
}

function isTokenResponse(data: OAuthTokenResponse | OAuthError): data is OAuthTokenResponse {
  return "access_token" in data;
}

export function accessTokenNeedsRefresh(
  credentials: StoredCredentials,
  now = Date.now(),
): boolean {
  return Date.parse(credentials.expiresAt) <= now + EXPIRY_BUFFER_MS;
}

export async function refreshCredentials(
  credentials: StoredCredentials,
  dependencies: AuthSessionDependencies = {},
): Promise<StoredCredentials> {
  if (!credentials.refreshToken) throw sessionExpiredError();

  const fetchRequest = dependencies.fetch ?? fetch;
  const remove = dependencies.deleteCredentials ?? deleteCredentials;
  const save = dependencies.saveCredentials ?? saveCredentials;
  const now = dependencies.now ?? Date.now;
  const response = await fetchRequest(endpoint(credentials.issuer, "oauth/token"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      refresh_token: credentials.refreshToken,
    }),
  });
  const data = (await response.json()) as OAuthTokenResponse | OAuthError;

  if (!response.ok || !isTokenResponse(data)) {
    const oauth = data as OAuthError;
    if (oauth.error === "invalid_grant") {
      await remove();
      throw sessionExpiredError();
    }
    throw new Error(oauthMessage(oauth, response.status));
  }

  const refreshed: StoredCredentials = {
    ...credentials,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? credentials.refreshToken,
    expiresAt: new Date(now() + data.expires_in * 1000).toISOString(),
    tokenType: data.token_type,
    ...(data.scope ? { scope: data.scope } : {}),
  };
  await save(refreshed);
  return refreshed;
}

export async function validCredentials(
  credentials: StoredCredentials,
  dependencies: AuthSessionDependencies = {},
): Promise<StoredCredentials> {
  const now = dependencies.now ?? Date.now;
  if (!accessTokenNeedsRefresh(credentials, now())) return credentials;
  return await refreshCredentials(credentials, dependencies);
}

function parseProfile(value: unknown): UserProfile {
  if (!value || typeof value !== "object") {
    throw new Error("Auth0 returned an invalid user profile.");
  }
  const profile = value as Partial<UserProfile>;
  if (
    typeof profile.sub !== "string" ||
    (profile.name !== undefined && typeof profile.name !== "string") ||
    (profile.email !== undefined && typeof profile.email !== "string")
  ) {
    throw new Error("Auth0 returned an invalid user profile.");
  }
  return profile as UserProfile;
}

async function requestProfile(
  credentials: StoredCredentials,
  fetchRequest: FetchLike,
): Promise<Response> {
  return await fetchRequest(endpoint(credentials.issuer, "userinfo"), {
    headers: { authorization: `${credentials.tokenType} ${credentials.accessToken}` },
  });
}

export async function loadUserProfile(
  credentials: StoredCredentials,
  dependencies: AuthSessionDependencies = {},
): Promise<{ credentials: StoredCredentials; profile: UserProfile }> {
  const fetchRequest = dependencies.fetch ?? fetch;
  let current = await validCredentials(credentials, dependencies);
  let response = await requestProfile(current, fetchRequest);

  if (response.status === 401 && current.refreshToken) {
    current = await refreshCredentials(current, dependencies);
    response = await requestProfile(current, fetchRequest);
  }

  if (!response.ok) {
    throw new Error(`Auth0 profile request failed with HTTP ${response.status}.`);
  }
  return { credentials: current, profile: parseProfile(await response.json()) };
}
