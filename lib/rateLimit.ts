import type { NextRequest } from "next/server";
import { getSql, type Sql } from "./adminDb";

// Fixed-window login rate limiting backed by Postgres (no Redis this week).
//
// A public, universal login URL will get credential-stuffed. We count FAILED
// attempts per client-IP per fixed time window; once a bucket exceeds the cap,
// further attempts are rejected with 429 until the window rolls over.
// Successful logins do not count, so a legitimate user is never locked out by
// their own sign-in.

const WINDOW_SEC = 15 * 60; // 15-minute window
const MAX_FAILURES = 10; // failed attempts per IP per window before blocking

let ensured = false;
async function ensureTable(sql: Sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_rate_limit (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL
  )`;
  ensured = true;
}

// Best-effort client IP. On Vercel the platform sets x-forwarded-for; the first
// entry is the real client. Falls back so a missing header never throws.
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function bucketKey(scope: string, ip: string): { key: string; windowId: number } {
  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SEC);
  return { key: `${scope}:${ip}:${windowId}`, windowId };
}

// Read-only check: is this IP currently over the failure cap for this scope?
// Returns retryAfter (seconds until the current window rolls over) for the
// 429 Retry-After header. If the DB isn't configured we fail open on the limit
// (login itself already returns 503 when the DB is down).
export async function isLoginRateLimited(
  scope: "client" | "admin",
  ip: string
): Promise<{ limited: boolean; retryAfter: number }> {
  const sql = getSql();
  if (!sql) return { limited: false, retryAfter: 0 };
  await ensureTable(sql);
  const { key } = bucketKey(scope, ip);
  const rows = (await sql`SELECT count FROM sentinel_rate_limit WHERE key = ${key} LIMIT 1`) as { count: number }[];
  const count = rows[0]?.count ?? 0;
  const retryAfter = WINDOW_SEC - (Math.floor(Date.now() / 1000) % WINDOW_SEC);
  return { limited: count >= MAX_FAILURES, retryAfter };
}

// Record one failed login. Atomically upserts the current window's counter and
// opportunistically prunes expired buckets so the table stays small.
export async function recordLoginFailure(scope: "client" | "admin", ip: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  const { key, windowId } = bucketKey(scope, ip);
  const expiresAt = new Date((windowId + 1) * WINDOW_SEC * 1000).toISOString();
  await sql`INSERT INTO sentinel_rate_limit (key, count, expires_at)
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET count = sentinel_rate_limit.count + 1`;
  await sql`DELETE FROM sentinel_rate_limit WHERE expires_at < now()`;
}
