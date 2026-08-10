import crypto from "crypto";
import { cookies } from "next/headers";
import { requireEnv } from "./env";

const COOKIE = "client_session";
const MAX_AGE = 60 * 60 * 24; // 24h — no revocation list, so short expiry caps the window.

// Fail closed: client sessions are signed with a dedicated secret. The secret is
// read LAZILY on first use (via requireEnv, then cached), NOT at module import —
// this module can be pulled into a client bundle, and reading the secret at
// import time throws in the browser (no server env there), crashing the page.
// Signing only ever runs on the server, so first-use evaluation still fails
// closed there. CLIENT_SESSION_SECRET is client-only and rotates freely.
let secretCache: string | null = null;
function sign(value: string) {
  secretCache ??= requireEnv("CLIENT_SESSION_SECRET");
  return crypto.createHmac("sha256", secretCache).update(value).digest("hex");
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
