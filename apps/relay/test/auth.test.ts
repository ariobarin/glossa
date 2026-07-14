import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { requireAuth, type AuthenticatedRequest } from "../src/auth.js";
import { loadConfig } from "../src/config.js";

test("Auth0 bearer validation enforces token identity and scope", async (context) => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const app = express();
  app.get("/.well-known/jwks.json", (_request, response) => {
    response.json({ keys: [publicJwk] });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;
  const issuer = `${origin}/`;
  const audience = "https://mcp.glossa.sh/";
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgres://localhost/glossa",
    GLOSSA_PUBLIC_ORIGIN: origin,
    GLOSSA_AUTH0_ISSUER: issuer,
    GLOSSA_AUTH0_AUDIENCE: audience,
  });
  app.get(
    "/protected",
    requireAuth(config, "glossa:access"),
    (request: AuthenticatedRequest, response) => {
      response.json({ subject: request.auth?.subject });
    },
  );

  async function token(options: {
    issuer?: string;
    audience?: string;
    scope?: string;
    expiresAt?: number;
    subject?: string;
  }): Promise<string> {
    return await new SignJWT({ scope: options.scope ?? "glossa:access" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(options.issuer ?? issuer)
      .setAudience(options.audience ?? audience)
      .setSubject(options.subject ?? "github|123")
      .setIssuedAt()
      .setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1_000) + 300)
      .sign(privateKey);
  }

  async function protectedRequest(accessToken?: string): Promise<Response> {
    return await fetch(`${origin}/protected`, {
      ...(accessToken
        ? { headers: { authorization: `Bearer ${accessToken}` } }
        : {}),
    });
  }

  const accepted = await protectedRequest(await token({}));
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { subject: "github|123" });

  const wrongIssuer = await protectedRequest(
    await token({ issuer: "https://wrong.example.com/" }),
  );
  assert.equal(wrongIssuer.status, 401);
  assert.deepEqual(await wrongIssuer.json(), { error: "invalid_token" });
  assert.match(
    wrongIssuer.headers.get("www-authenticate") ?? "",
    /error="invalid_token"/,
  );

  const wrongAudience = await protectedRequest(
    await token({ audience: "https://other.example.com/" }),
  );
  assert.equal(wrongAudience.status, 401);

  const expired = await protectedRequest(
    await token({ expiresAt: Math.floor(Date.now() / 1_000) - 60 }),
  );
  assert.equal(expired.status, 401);

  const insufficientScope = await protectedRequest(
    await token({ scope: "glossa:device" }),
  );
  assert.equal(insufficientScope.status, 403);
  assert.deepEqual(await insufficientScope.json(), {
    error: "insufficient_scope",
  });
  assert.match(
    insufficientScope.headers.get("www-authenticate") ?? "",
    /scope="glossa:access"/,
  );

  const missing = await protectedRequest();
  assert.equal(missing.status, 401);
  assert.match(
    missing.headers.get("www-authenticate") ?? "",
    /oauth-protected-resource/,
  );
});
