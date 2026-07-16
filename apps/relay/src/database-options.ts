import type { PoolConfig } from "pg";

const SSL_QUERY_PARAMETERS = new Set([
  "ssl",
  "sslcert",
  "sslkey",
  "sslmode",
  "sslnegotiation",
  "sslrootcert",
  "uselibpqcompat",
]);

export function databaseOptions(
  databaseUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
): Pick<PoolConfig, "connectionString" | "ssl"> {
  if (environment.NODE_ENV !== "production") {
    return { connectionString: databaseUrl, ssl: undefined };
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid Postgres URL.");
  }
  for (const key of url.searchParams.keys()) {
    if (SSL_QUERY_PARAMETERS.has(key.toLowerCase())) {
      throw new Error(
        "DATABASE_URL must not contain SSL parameters in production. Use GLOSSA_DATABASE_CA_PEM for a private database CA.",
      );
    }
  }

  const ca = environment.GLOSSA_DATABASE_CA_PEM?.trim();
  return {
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    },
  };
}
