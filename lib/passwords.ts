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
