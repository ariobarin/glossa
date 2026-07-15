import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const usage =
  "Usage: npm run admit --workspace @glossa/relay -- '<auth0-user-id>'";

async function main(): Promise<void> {
  const [subject, ...extraArguments] = process.argv.slice(2);
  if (
    !subject ||
    extraArguments.length > 0 ||
    subject.length > 255 ||
    !/^[^\s|]+\|[^\s|]+$/.test(subject)
  ) {
    throw new Error(usage);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 1,
    connectionTimeoutMillis: 30_000,
  });

  try {
    await pool.query(
      `INSERT INTO accounts (id, auth0_subject, admitted_at)
       VALUES ($1, $2, now())
       ON CONFLICT (auth0_subject) DO UPDATE
       SET admitted_at = now(), disabled_at = NULL`,
      [randomUUID(), subject],
    );
    console.log("Glossa tester admitted.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admission failed.");
  process.exitCode = 1;
});
