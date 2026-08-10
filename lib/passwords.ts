import crypto from "crypto";
import { requireEnv } from "./env";

// scrypt-based password hashing (no external deps). Format: "salt:hexhash".
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const dk = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${dk}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, key] = stored.split(":");
  const dk = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  return dk.length === keyBuf.length && crypto.timingSafeEqual(dk, keyBuf);
}

// Reversible encryption (AES-256-GCM) for credentials the admin must be able
// to reveal again (e.g. a client's portal password). The key is derived from a
// server-only secret; a database dump alone cannot reveal the value.
//
// Fail closed: APP_ENCRYPTION_KEY has NO fallback and throws at import so a
// missing value fails the deploy instead of silently encrypting under a public
// string. Unlike the session secrets, this key must NOT be rotated casually —
// existing password_enc / *_api_key_enc rows were encrypted under the previous
// key. In production set APP_ENCRYPTION_KEY to the SAME value the data was
// encrypted under (previously the ADMIN_SESSION_SECRET value); rotating to a new
// value requires a decrypt-then-re-encrypt migration or the data is lost.
const ENC_KEY: Buffer = crypto.scryptSync(requireEnv("APP_ENCRYPTION_KEY"), "sentinel-pw-enc-v1", 32);

function encKey(): Buffer {
  return ENC_KEY;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const [, ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    // A GCM auth failure here almost always means this value was encrypted under
    // a different APP_ENCRYPTION_KEY than the one now configured (e.g. the key
    // was rotated without a decrypt-then-re-encrypt migration). Surface it
    // loudly rather than returning null silently — the value itself is never
    // logged. Callers still degrade gracefully to null.
    console.warn(
      "[passwords] decryptSecret failed: a stored *_enc value could not be decrypted " +
        "with the current APP_ENCRYPTION_KEY (key rotated without re-encrypt migration?)"
    );
    return null;
  }
}
