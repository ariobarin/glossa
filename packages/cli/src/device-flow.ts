import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./open-browser.js";
import { saveCredentials } from "./config-store.js";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface TokenResponse {
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

export interface LoginOptions {
  issuer: string;
  clientId: string;
  audience: string;
  scope: string;
}

function endpoint(issuer: string, pathname: string): string {
  return new URL(pathname, issuer.endsWith("/") ? issuer : `${issuer}/`).toString();
}

async function postForm<T>(url: string, values: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const data = (await response.json()) as T;
  if (!response.ok) {
    const oauth = data as OAuthError;
    throw new Error(oauth.error_description ?? oauth.error ?? `HTTP ${response.status}`);
  }
  return data;
}

export async function loginWithDeviceFlow(options: LoginOptions): Promise<void> {
  const code = await postForm<DeviceCodeResponse>(
    endpoint(options.issuer, "oauth/device/code"),
    {
      client_id: options.clientId,
      audience: options.audience,
      scope: options.scope,
    },
  );

  const verificationUrl = code.verification_uri_complete ?? code.verification_uri;
  const opened = await openBrowser(verificationUrl);

  console.log(opened ? "Opened your browser for Glossa login." : "Open this URL to sign in:");
  console.log(verificationUrl);
  if (!code.verification_uri_complete) console.log(`Code: ${code.user_code}`);

  const startedAt = Date.now();
  let intervalSeconds = Math.max(code.interval ?? 5, 1);

  while (Date.now() - startedAt < code.expires_in * 1000) {
    await delay(intervalSeconds * 1000);

    const response = await fetch(endpoint(options.issuer, "oauth/token"), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: code.device_code,
        client_id: options.clientId,
      }),
    });

    const data = (await response.json()) as TokenResponse | OAuthError;
    if (response.ok && "access_token" in data) {
      await saveCredentials({
        accessToken: data.access_token,
        ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
        expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        tokenType: data.token_type,
        ...(data.scope ? { scope: data.scope } : {}),
      });
      console.log("Signed in to Glossa.");
      console.warn(
        "MVP scaffold uses a mode-0600 credential file. Replace it with an OS credential-store adapter before public beta.",
      );
      return;
    }

    const error = data as OAuthError;
    if (error.error === "authorization_pending") continue;
    if (error.error === "slow_down") {
      intervalSeconds += 5;
      continue;
    }
    if (error.error === "access_denied") throw new Error("Login was denied.");
    if (error.error === "expired_token") throw new Error("The login code expired.");
    throw new Error(error.error_description ?? error.error);
  }

  throw new Error("The login code expired.");
}
