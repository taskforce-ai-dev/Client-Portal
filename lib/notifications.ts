import { ensureSeed, getSql } from "./adminDb";

export type QuotaNotificationKind = "warn" | "exceeded";

export type QuotaNotification = {
  id: string;
  agentId: string;
  kind: QuotaNotificationKind;
  summary: string;
  occurredAt: string;
};

export type NotificationsRange = "total" | "today" | "week" | "month" | "custom";

function computeWindow(range: NotificationsRange, customStart?: string, customEnd?: string) {
  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let endDate = now;
  let useDateFilter = true;
  let customMissing = false;
  if (range === "total") useDateFilter = false;
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    if (customStart && customEnd) {
      start = new Date(customStart + "T00:00:00Z");
      endDate = new Date(customEnd + "T23:59:59Z");
    } else customMissing = true;
  }
  return { start, endDate, useDateFilter, customMissing };
}

function rowToNotification(r: { id: string; action: string; target: string | null; summary: string; occurred_at: string }): QuotaNotification {
  const kind: QuotaNotificationKind = r.action === "client.quota.exceeded" ? "exceeded" : "warn";
  return {
    id: r.id,
    agentId: r.target || "",
    kind,
    summary: r.summary,
    occurredAt: r.occurred_at,
  };
}

export async function listAgentNotifications(
  agentId: string,
  range: NotificationsRange = "total",
  opts: { customStart?: string; customEnd?: string } = {},
): Promise<{ items: QuotaNotification[]; range: NotificationsRange; customMissing: boolean }> {
  const sql = getSql();
  if (!sql) return { items: [], range, customMissing: false };
  await ensureSeed(sql);
  const { start, endDate, useDateFilter, customMissing } = computeWindow(range, opts.customStart, opts.customEnd);
  if (customMissing) return { items: [], range, customMissing: true };

  const rows = useDateFilter
    ? (await sql`SELECT id, action, target, summary, occurred_at
                 FROM sentinel_audit
                 WHERE target = ${agentId}
                   AND action LIKE 'client.quota.%'
                   AND occurred_at >= ${start.toISOString()}
                   AND occurred_at <= ${endDate.toISOString()}
                 ORDER BY occurred_at DESC
                 LIMIT 500`) as any[]
    : (await sql`SELECT id, action, target, summary, occurred_at
                 FROM sentinel_audit
                 WHERE target = ${agentId}
                   AND action LIKE 'client.quota.%'
                 ORDER BY occurred_at DESC
                 LIMIT 500`) as any[];
  return { items: rows.map(rowToNotification), range, customMissing: false };
}

// Count of notifications that arrived AFTER the client's last visit to
// the Notifications tab (the cookie set by /api/.../notifications/mark-read).
// Falls back to the start of the calendar month when no cookie exists, so
// brand-new clients see their first warning/exceeded immediately.
export async function countCurrentMonthNotifications(agentId: string, sinceIso?: string | null): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;
  await ensureSeed(sql);
  const now = new Date();
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const cutoff = sinceIso && /^\d{4}-\d{2}-\d{2}T/.test(sinceIso) ? sinceIso : monthStartIso;
  const rows = (await sql`SELECT count(*)::int AS n FROM sentinel_audit
                          WHERE target = ${agentId}
                            AND action LIKE 'client.quota.%'
                            AND occurred_at > ${cutoff}`) as { n: number }[];
  return rows[0]?.n ?? 0;
}
