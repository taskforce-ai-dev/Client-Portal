import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "client_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "sentinel-dev-secret-change-me";
}
function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
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
