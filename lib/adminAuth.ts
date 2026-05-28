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

export function checkCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}
