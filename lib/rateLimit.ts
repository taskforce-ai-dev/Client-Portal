import type { NextRequest } from "next/server";
import { getSql, type Sql } from "./adminDb";

// Fixed-window login rate limiting backed by Postgres (no Redis this week).
//
// A public, universal login URL will get credential-stuffed. We count FAILED
// attempts per client-IP per fixed time window; once a bucket exceeds the cap,
// further attempts are rejected with 429 until the window rolls over.
//
// Concurrency: the count-and-check is a SINGLE atomic statement
// (INSERT ... ON CONFLICT DO UPDATE ... RETURNING), so a burst of parallel
// requests each observe a distinct incremented value — there is no
// check-then-act window where several requests read the same stale count and
// all slip through. Successful logins call refundLoginAttempt() so a legit user
// signing in is never counted toward the cap.

const WINDOW_SEC = 15 * 60; // 15-minute window
const MAX_ATTEMPTS = 10; // failed attempts per IP per window before blocking

let ensured = false;
async function ensureTable(sql: Sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_rate_limit (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL
  )`;
  // Index the prune predicate so the occasional cleanup below is not a scan.
  await sql`CREATE INDEX IF NOT EXISTS sentinel_rate_limit_expires_idx ON sentinel_rate_limit (expires_at)`;
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

function bucket(scope: string, ip: string): { key: string; windowId: number } {
  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SEC);
  return { key: `${scope}:${ip}:${windowId}`, windowId };
}

function retryAfterSeconds(): number {
  return WINDOW_SEC - (Math.floor(Date.now() / 1000) % WINDOW_SEC);
}

// Atomically count this attempt and report whether the caller is now over the
// cap. Because the increment and the returned value come from one statement,
// concurrent callers cannot all read the same pre-increment count — each gets
// its own slot, so only the first MAX_ATTEMPTS in a window proceed.
//
// When the DB is not configured this is a no-op (returns not-limited). That
// only happens off-production (local/dev); see the admin-login note below.
export async function consumeLoginAttempt(
  scope: "client" | "admin",
  ip: string
): Promise<{ limited: boolean; retryAfter: number }> {
  const retryAfter = retryAfterSeconds();
  const sql = getSql();
  if (!sql) return { limited: false, retryAfter };
  await ensureTable(sql);
  const { key, windowId } = bucket(scope, ip);
  const expiresAt = new Date((windowId + 1) * WINDOW_SEC * 1000).toISOString();
  const rows = (await sql`INSERT INTO sentinel_rate_limit (key, count, expires_at)
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET count = sentinel_rate_limit.count + 1
    RETURNING count`) as { count: number }[];
  const count = rows[0]?.count ?? 1;
  // Opportunistic, indexed prune on ~1% of calls — keeps the table from
  // growing without a DELETE scan on every single login attempt.
  if (Math.random() < 0.01) {
    try {
      await sql`DELETE FROM sentinel_rate_limit WHERE expires_at < now()`;
    } catch {
      /* prune is best-effort */
    }
  }
  return { limited: count > MAX_ATTEMPTS, retryAfter };
}

// Give back the slot a successful login consumed, so a legitimate user who
// signs in (possibly after a couple of typos) is never counted toward the
// failure cap. Only wrong-credential attempts remain counted.
export async function refundLoginAttempt(scope: "client" | "admin", ip: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const { key } = bucket(scope, ip);
  await sql`UPDATE sentinel_rate_limit SET count = GREATEST(count - 1, 0) WHERE key = ${key}`;
}
