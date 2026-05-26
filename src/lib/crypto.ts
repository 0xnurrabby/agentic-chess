import crypto from "node:crypto";

/**
 * Optional at-rest encryption for the persona/wallet store. When
 * ENCRYPTION_KEY (64 hex chars = 32 bytes) is set, persisted JSON is wrapped
 * with AES-256-GCM. Without it, content passes through as plaintext so the app
 * still runs in dev — a warning is logged once.
 *
 * Encrypted payload format (single line):
 *   ENC1:<iv hex>:<authTag hex>:<ciphertext hex>
 */

const ALGO = "aes-256-gcm";
const PREFIX = "ENC1:";

let warnedNoKey = false;

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;
  let key: Buffer;
  try {
    key = Buffer.from(hex.trim(), "hex");
  } catch {
    return null;
  }
  if (key.length !== 32) {
    console.warn(
      `[crypto] ENCRYPTION_KEY must be 64 hex chars (32 bytes); got ${key.length} bytes — ignoring`,
    );
    return null;
  }
  return key;
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

/** Encrypt a UTF-8 string. Returns plaintext unchanged if no key is configured. */
export function encryptString(plain: string): string {
  const key = getKey();
  if (!key) {
    if (!warnedNoKey) {
      console.warn(
        "[crypto] ENCRYPTION_KEY not set — persisting store as plaintext",
      );
      warnedNoKey = true;
    }
    return plain;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/**
 * Decrypt a payload produced by encryptString. Plaintext (no ENC1 prefix) is
 * returned as-is so existing unencrypted stores keep loading.
 */
export function decryptString(data: string): string {
  if (!data.startsWith(PREFIX)) return data; // plaintext / legacy
  const key = getKey();
  if (!key) {
    throw new Error(
      "[crypto] store is encrypted but ENCRYPTION_KEY is not set",
    );
  }
  const [, ivHex, tagHex, ctHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
