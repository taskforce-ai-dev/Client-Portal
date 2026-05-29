import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "sentinel_admin";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "sentinel-dev-secret-change-me";
}

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@taskforceai.tech").toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sentinel2026";
export const SENTINEL_COOKIE = COOKIE;
export const SENTINEL_MAX_AGE = MAX_AGE;

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createToken() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [sub, exp, sig] = parts;
  const expected = sign(`${sub}.${exp}`);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Date.now() <= Number(exp);
}

export function isAuthed(): boolean {
  return verifyToken(cookies().get(COOKIE)?.value);
}

// Verify against the admins table in the DB; fall back to the env bootstrap
// admin when the DB isn't configured (so you're never locked out locally).
export async function checkCredentials(email: string, password: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  try {
    const { findAdminByEmail, isDbConfigured } = await import("./adminDb");
    if (isDbConfigured()) {
      const admin = await findAdminByEmail(e);
      if (admin) {
        const { verifyPassword } = await import("./passwords");
        return verifyPassword(password, admin.password_hash);
      }
      // DB configured but admin row missing — allow the env bootstrap admin.
    }
  } catch {
    // fall through to env check
  }
  return e === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}
