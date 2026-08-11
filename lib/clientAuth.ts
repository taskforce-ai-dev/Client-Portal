import crypto from "crypto";
import { cookies } from "next/headers";
import { requireEnv } from "./env";

const COOKIE = "client_session";
const MAX_AGE = 60 * 60 * 24; // 24h — no revocation list, so short expiry caps the window.

// Fail closed: client sessions are signed with a dedicated secret, read LAZILY
// on first use (cached), NOT at module import — this module can be pulled into a
// client bundle, and reading the secret at import time throws in the browser (no
// server env), crashing the page. Signing only ever runs on the server.
let secretCache: string | null = null;
function sign(value: string) {
  secretCache ??= requireEnv("CLIENT_SESSION_SECRET");
  return crypto.createHmac("sha256", secretCache).update(value).digest("hex");
}

export const CLIENT_COOKIE = COOKIE;
export const CLIENT_MAX_AGE = MAX_AGE;

function makeToken(subject: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${subject}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

// Legacy company token (subject = clientId). Kept for back-compat with the
// pre-RBAC single login and any in-flight sessions.
export function createClientToken(clientId: string): string {
  return makeToken(clientId);
}

// Per-user token. The subject embeds BOTH ids ("u:<userId>:<clientId>") so the
// session resolves synchronously with no DB lookup. Ids are dot/colon-free.
export function createClientUserToken(userId: string, clientId: string): string {
  return makeToken(`u:${userId}:${clientId}`);
}

// Verify signature + expiry; return the raw subject (or null).
function verifySubject(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;
  const sig = parts[parts.length - 1];
  const exp = parts[parts.length - 2];
  const subject = parts.slice(0, -2).join(".");
  if (!subject || !exp || !sig) return null;
  const expected = sign(`${subject}.${exp}`);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  if (Date.now() > Number(exp)) return null;
  return subject;
}

export type ClientSession = { clientId: string; userId: string | null };

function parseSubject(subject: string): ClientSession {
  if (subject.startsWith("u:")) {
    const rest = subject.slice(2);
    const sep = rest.indexOf(":");
    if (sep > 0) return { userId: rest.slice(0, sep), clientId: rest.slice(sep + 1) };
  }
  return { clientId: subject, userId: null };
}

// Back-compat: still carries `clientId` that every existing caller relies on,
// now also `userId` (null for legacy company sessions).
export function verifyClientToken(token: string | undefined): ClientSession | null {
  const subject = verifySubject(token);
  return subject ? parseSubject(subject) : null;
}

export function getClientSession(): ClientSession | null {
  return verifyClientToken(cookies().get(COOKIE)?.value);
}
