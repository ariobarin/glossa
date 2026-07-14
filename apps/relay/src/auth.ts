import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { RelayConfig } from "./config.js";

export interface AuthenticatedRequest extends Request {
  auth?: {
    subject: string;
    scopes: Set<string>;
    claims: JWTPayload;
  };
}

function bearerToken(request: Request): string | null {
  const header = request.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function scopes(payload: JWTPayload): Set<string> {
  const claim = typeof payload.scope === "string" ? payload.scope : "";
  return new Set(claim.split(/\s+/).filter(Boolean));
}

function authenticationChallenge(
  config: RelayConfig,
  error?: "invalid_token" | "insufficient_scope",
  requiredScope?: string,
): string {
  const origin = config.GLOSSA_PUBLIC_ORIGIN.replace(/\/$/, "");
  const parameters = [
    `resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    ...(error ? [`error="${error}"`] : []),
    ...(requiredScope ? [`scope="${requiredScope}"`] : []),
  ];
  return `Bearer ${parameters.join(", ")}`;
}

export function requireAuth(config: RelayConfig, requiredScope?: string) {
  const issuer = config.GLOSSA_AUTH0_ISSUER.endsWith("/")
    ? config.GLOSSA_AUTH0_ISSUER
    : `${config.GLOSSA_AUTH0_ISSUER}/`;
  const jwks = createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));

  return async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const token = bearerToken(request);
    if (!token) {
      response.setHeader(
        "WWW-Authenticate",
        authenticationChallenge(config),
      );
      response.status(401).json({ error: "authentication_required" });
      return;
    }

    try {
      const verified = await jwtVerify(token, jwks, {
        issuer,
        audience: config.GLOSSA_AUTH0_AUDIENCE,
      });
      if (!verified.payload.sub) throw new Error("Missing subject.");
      const grantedScopes = scopes(verified.payload);
      if (requiredScope && !grantedScopes.has(requiredScope)) {
        response.setHeader(
          "WWW-Authenticate",
          authenticationChallenge(config, "insufficient_scope", requiredScope),
        );
        response.status(403).json({ error: "insufficient_scope" });
        return;
      }
      request.auth = {
        subject: verified.payload.sub,
        scopes: grantedScopes,
        claims: verified.payload,
      };
      next();
    } catch {
      response.setHeader(
        "WWW-Authenticate",
        authenticationChallenge(config, "invalid_token"),
      );
      response.status(401).json({ error: "invalid_token" });
    }
  };
}
