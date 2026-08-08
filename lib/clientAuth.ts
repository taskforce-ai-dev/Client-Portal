import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "client_session";
const MAX_AGE = 60 * 60 * 24; // 24h — no revocation list, so short expiry caps the window.

// Fail closed: client sessions must be signed with a dedicated secret. A missing
// value throws at import so the deploy fails instead of silently signing cookies
// with a public fallback string. CLIENT_SESSION_SECRET is client-only and may be
// rotated freely (everyone just logs in again).
const SECRET = (() => {
  const v = process.env.CLIENT_SESSION_SECRET;
  if (!v || !v.trim()) {
    throw new Error(
      "CLIENT_SESSION_SECRET is not set. Refusing to start — client sessions cannot be secured."
    );
  }
  return v;
})();

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export const CLIENT_COOKIE = COOKIE;
export const CLIENT_MAX_AGE = MAX_AGE;

export function createClientToken(clientId: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${clientId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyClientToken(token: string | undefined): { clientId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;
  // Subject (clientId) may contain dots — anchor on the last two parts.
  const sig = parts[parts.length - 1];
  const exp = parts[parts.length - 2];
  const clientId = parts.slice(0, -2).join(".");
  if (!clientId || !exp || !sig) return null;
  const expected = sign(`${clientId}.${exp}`);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  if (Date.now() > Number(exp)) return null;
  return { clientId };
}

export function getClientSession(): { clientId: string } | null {
  return verifyClientToken(cookies().get(COOKIE)?.value);
}
