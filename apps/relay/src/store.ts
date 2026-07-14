import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { generateDeviceToken, verifyDeviceSecret } from "./device-token.js";

export interface DeviceRecord {
  id: string;
  accountId: string;
  name: string;
  platform: string | null;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
}

export class Store {
  readonly #pool: Pool;

  constructor(databaseUrl: string) {
    this.#pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }

  async accountIdForSubject(subject: string): Promise<string> {
    const result = await this.#pool.query<{ id: string }>(
      `INSERT INTO accounts (id, auth0_subject)
       VALUES ($1, $2)
       ON CONFLICT (auth0_subject)
       DO UPDATE SET auth0_subject = EXCLUDED.auth0_subject
       RETURNING id`,
      [randomUUID(), subject],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Failed to resolve account.");
    return row.id;
  }

  async enrollDevice(
    accountId: string,
    name: string,
    platform: string | null,
  ): Promise<{ device: DeviceRecord; token: string }> {
    const generated = await generateDeviceToken();
    const result = await this.#pool.query<{
      id: string;
      account_id: string;
      name: string;
      platform: string | null;
      revoked_at: Date | null;
      last_seen_at: Date | null;
    }>(
      `INSERT INTO devices (
         id, account_id, name, platform, token_salt, token_hash, token_version
       ) VALUES ($1, $2, $3, $4, $5, $6, 1)
       RETURNING id, account_id, name, platform, revoked_at, last_seen_at`,
      [
        generated.deviceId,
        accountId,
        name,
        platform,
        generated.salt,
        generated.hash,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Failed to enroll device.");
    return {
      device: {
        id: row.id,
        accountId: row.account_id,
        name: row.name,
        platform: row.platform,
        revokedAt: row.revoked_at,
        lastSeenAt: row.last_seen_at,
      },
      token: generated.token,
    };
  }

  async listDevices(accountId: string): Promise<DeviceRecord[]> {
    const result = await this.#pool.query<{
      id: string;
      account_id: string;
      name: string;
      platform: string | null;
      revoked_at: Date | null;
      last_seen_at: Date | null;
    }>(
      `SELECT id, account_id, name, platform, revoked_at, last_seen_at
       FROM devices
       WHERE account_id = $1
       ORDER BY created_at ASC`,
      [accountId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      platform: row.platform,
      revokedAt: row.revoked_at,
      lastSeenAt: row.last_seen_at,
    }));
  }

  async revokeDevice(accountId: string, deviceId: string): Promise<boolean> {
    const result = await this.#pool.query(
      `UPDATE devices
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE account_id = $1 AND id = $2`,
      [accountId, deviceId],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async authenticateDevice(
    deviceId: string,
    secret: string,
  ): Promise<DeviceRecord | null> {
    const result = await this.#pool.query<{
      id: string;
      account_id: string;
      name: string;
      platform: string | null;
      token_salt: Buffer;
      token_hash: Buffer;
      revoked_at: Date | null;
      last_seen_at: Date | null;
    }>(
      `SELECT id, account_id, name, platform, token_salt, token_hash,
              revoked_at, last_seen_at
       FROM devices
       WHERE id = $1`,
      [deviceId],
    );
    const row = result.rows[0];
    if (!row || row.revoked_at) return null;
    if (!(await verifyDeviceSecret(secret, row.token_salt, row.token_hash))) return null;
    await this.#pool.query(`UPDATE devices SET last_seen_at = now() WHERE id = $1`, [
      deviceId,
    ]);
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      platform: row.platform,
      revokedAt: row.revoked_at,
      lastSeenAt: new Date(),
    };
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const value = await callback(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
