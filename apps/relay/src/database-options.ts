import type { PoolConfig } from "pg";

export function databaseSsl(
  environment: NodeJS.ProcessEnv = process.env,
): PoolConfig["ssl"] {
  if (environment.NODE_ENV !== "production") return undefined;

  const ca = environment.GLOSSA_DATABASE_CA_PEM?.trim();
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
  };
}
