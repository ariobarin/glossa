export interface AuthConfig {
  issuer: string;
  clientId: string;
  audience: string;
  scope: string;
}

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  issuer: "https://dev-fl2h5xhp6umeh74m.us.auth0.com/",
  clientId: "9mwnK9nTAd8q1kxnKIZxC1wodxzfWHg5",
  audience: "https://mcp.glossa.sh/",
  scope: "openid profile offline_access glossa:device",
};

function configuredValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: string,
): string {
  const value = environment[name]?.trim();
  return value || fallback;
}

export function loadAuthConfig(environment: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    issuer: configuredValue(environment, "GLOSSA_AUTH0_ISSUER", DEFAULT_AUTH_CONFIG.issuer),
    clientId: configuredValue(
      environment,
      "GLOSSA_AUTH0_CLI_CLIENT_ID",
      DEFAULT_AUTH_CONFIG.clientId,
    ),
    audience: configuredValue(
      environment,
      "GLOSSA_AUTH0_AUDIENCE",
      DEFAULT_AUTH_CONFIG.audience,
    ),
    scope: DEFAULT_AUTH_CONFIG.scope,
  };
}
