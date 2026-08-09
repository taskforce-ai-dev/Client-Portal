import crypto from "crypto";
import { cookies } from "next/headers";
import { requireEnv } from "./env";

const COOKIE = "sentinel_admin";
const MAX_AGE = 60 * 60 * 24; // 24h — no revocation list, so short expiry caps the window.

// Fail closed: admin sessions are signed with a dedicated secret. Read LAZILY on
// first use (via requireEnv, then cached), NOT at module import — this module can
// be pulled into a client bundle, and reading the secret at import time throws in
// the browser (no server env there), crashing the page. Signing only ever runs on
// the server, so first-use evaluation still fails closed. ADMIN_SESSION_SECRET is
// admin-only and rotates freely.
let secretCache: string | null = null;

// Demo-admin-credentials code path. Fallback values are gated to
// non-production only — on a public URL, an unset ADMIN_EMAIL/ADMIN_PASSWORD
// in production must disable this env-bootstrap login entirely rather than
// silently accept a well-known default. DB-backed admins (Invite Admin)
// are unaffected either way.
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || (IS_PRODUCTION ? "" : "admin@taskforceai.tech")).toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? "" : "sentinel2026");
export const SENTINEL_COOKIE = COOKIE;
export const SENTINEL_MAX_AGE = MAX_AGE;

function sign(value: string) {
  secretCache ??= requireEnv("ADMIN_SESSION_SECRET");
  return crypto.createHmac("sha256", secretCache).update(value).digest("hex");
}

export function createToken(subject = "admin") {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${subject}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

// Parse a token of the form `${subject}.${exp}.${sig}`. The subject can
// contain dots (e.g. email addresses), so we anchor on the LAST two parts.
function parseToken(token: string | undefined): { sub: string; exp: string; sig: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;
  const sig = parts[parts.length - 1];
  const exp = parts[parts.length - 2];
  const sub = parts.slice(0, -2).join(".");
  if (!sub || !exp || !sig) return null;
  return { sub, exp, sig };
}

export function verifyToken(token: string | undefined): boolean {
  const p = parseToken(token);
  if (!p) return false;
  const expected = sign(`${p.sub}.${p.exp}`);
  if (p.sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(p.sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  return Date.now() <= Number(p.exp);
}

export function isAuthed(): boolean {
  return verifyToken(cookies().get(COOKIE)?.value);
}

// Returns the signed-in admin's subject (email for real DB admins, or "admin"
// for the bootstrap/env admin and legacy sessions). null if not signed in.
export function getAdminSubject(): string | null {
  const token = cookies().get(COOKIE)?.value;
  const p = parseToken(token);
  if (!p) return null;
  const expected = sign(`${p.sub}.${p.exp}`);
  if (p.sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(p.sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  if (Date.now() > Number(p.exp)) return null;
  return p.sub;
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
  return !!ADMIN_EMAIL && !!ADMIN_PASSWORD && e === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}
