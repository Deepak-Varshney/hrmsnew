// lib/crypto.ts
//
// Field-level encryption for the handful of employee fields that are
// genuinely sensitive at rest: Aadhaar, PAN, and bank account number.
//
// AES-256-GCM. The key comes from FIELD_ENCRYPTION_KEY (64 hex chars = 32
// bytes). Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// TRADE-OFF: encrypted fields cannot be queried, sorted, or indexed by value.
// That is acceptable here — nobody searches employees by Aadhaar number. If
// that ever becomes a requirement, add a separate blind-index (HMAC) field
// rather than weakening this.

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is required. Generate one with:\n" +
        `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)."
    );
  }

  cachedKey = Buffer.from(raw, "hex");
  return cachedKey;
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptField(plain?: string | null): string | null {
  if (plain == null || plain === "") return null;
  if (isEncrypted(plain)) return plain; // already encrypted — don't double-wrap

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    PREFIX +
    [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(
      ":"
    )
  );
}

export function decryptField(stored?: string | null): string | null {
  if (stored == null || stored === "") return null;
  if (!isEncrypted(stored)) return stored; // legacy plaintext, pre-migration

  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return (
      decipher.update(Buffer.from(dataB64, "base64")).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    // Wrong key or tampered ciphertext. Never leak the raw value.
    return null;
  }
}

/** Mongoose field config fragment for an encrypted string. */
export const encryptedString = {
  type: String,
  set: encryptField,
  get: decryptField,
  default: null,
};
