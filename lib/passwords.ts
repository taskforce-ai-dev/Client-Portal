import crypto from "crypto";

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
// to reveal again (e.g. a client's portal password). The key is derived from
// a server-only secret; a database dump alone cannot reveal the value.
function encKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || "sentinel-dev-secret-change-me";
  return crypto.scryptSync(secret, "sentinel-pw-enc-v1", 32);
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
    return null;
  }
}
