import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const PREFIX = "gld";

export interface GeneratedDeviceToken {
  deviceId: string;
  token: string;
  salt: Buffer;
  hash: Buffer;
}

export interface ParsedDeviceToken {
  deviceId: string;
  secret: string;
}

export function parseDeviceToken(token: string): ParsedDeviceToken | null {
  const match = /^gld_([0-9a-f-]{36})_([A-Za-z0-9_-]{40,})$/.exec(token);
  if (!match?.[1] || !match[2]) return null;
  return { deviceId: match[1], secret: match[2] };
}

async function hashSecret(secret: string, salt: Buffer): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      secret,
      salt,
      32,
      {
        N: 2 ** 15,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function generateDeviceToken(): Promise<GeneratedDeviceToken> {
  const deviceId = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const salt = randomBytes(16);
  const hash = await hashSecret(secret, salt);
  return {
    deviceId,
    token: `${PREFIX}_${deviceId}_${secret}`,
    salt,
    hash,
  };
}

export async function verifyDeviceSecret(
  secret: string,
  salt: Buffer,
  expectedHash: Buffer,
): Promise<boolean> {
  const actual = await hashSecret(secret, salt);
  return actual.length === expectedHash.length && timingSafeEqual(actual, expectedHash);
}
