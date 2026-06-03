import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured, listTokenUsage } from "@/lib/adminDb";
import { lkrFromMicros, usdFromMicros } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// Per-agent token usage snapshot for the selected range.
// Query: ?range=total|today|week|month|custom (&start=YYYY-MM-DD&end=YYYY-MM-DD)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  let range = sp.get("range") || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";

  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let endDate = now;
  let useDateFilter = true;
  let customMissing = false;
  if (range === "total") { useDateFilter = false; start.setDate(now.getDate() - 29); }
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    if (sp.get("start") && sp.get("end")) {
      start = new Date(sp.get("start") + "T00:00:00Z");
      endDate = new Date(sp.get("end") + "T00:00:00Z");
    } else { customMissing = true; start.setDate(now.getDate() - 29); }
  } // today: start = today

  const startIso = useDateFilter && !customMissing ? start.toISOString() : undefined;
  const endIso = useDateFilter && !customMissing ? new Date(endDate.getTime() + 86400000).toISOString() : undefined;
  const rows = await listTokenUsage(agent.id, { startIso, endIso, limit: 5000 });

  let totalInput = 0, totalOutput = 0, totalCacheW = 0, totalCacheR = 0, totalCostMicros = 0;
  const byModel: Record<string, { calls: number; input: number; output: number; cost_micros: number }> = {};
  for (const r of rows) {
    totalInput += r.input_tokens;
    totalOutput += r.output_tokens;
    totalCacheW += r.cache_creation_tokens;
    totalCacheR += r.cache_read_tokens;
    totalCostMicros += Number(r.cost_usd_micros) || 0;
    const m = r.model || "unknown";
    if (!byModel[m]) byModel[m] = { calls: 0, input: 0, output: 0, cost_micros: 0 };
    byModel[m].calls += 1;
    byModel[m].input += r.input_tokens;
    byModel[m].output += r.output_tokens;
    byModel[m].cost_micros += Number(r.cost_usd_micros) || 0;
  }

  // Series: cost by hour for today, cost by day otherwise.
  let series: { label: string; value: number }[];
  let seriesLabel: string;
  if (range === "today") {
    const byHour = new Map<number, number>();
    for (const r of rows) {
      const d = new Date(r.occurred_at);
      if (isNaN(d.getTime())) continue;
      const h = d.getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + (Number(r.cost_usd_micros) || 0));
    }
    const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    series = hours.map((h) => ({
      label: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
      value: usdFromMicros((byHour.get(h) ?? 0) + (byHour.get(h - 1) ?? 0)),
    }));
    seriesLabel = "Cost by hour ($)";
  } else {
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.occurred_at);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      byDay.set(key, (byDay.get(key) ?? 0) + (Number(r.cost_usd_micros) || 0));
    }
    const dayMs = 86400000;
    const s0 = new Date(start); s0.setHours(0, 0, 0, 0);
    const out: { label: string; value: number }[] = [];
    for (let t = s0.getTime(); t <= endDate.getTime() && out.length < 120; t += dayMs) {
      const d = new Date(t);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: usdFromMicros(byDay.get(key) ?? 0) });
    }
    series = out;
    seriesLabel = range === "total" ? "Cost by day ($, last 30 days)" : "Cost by day ($)";
  }

  return NextResponse.json({
    configured: true,
    range,
    start: range === "total" ? null : ymd(start),
    end: range === "total" ? null : ymd(endDate),
    agent: { id: agent.id, name: agent.name },
    rows: rows.length,
    kpis: {
      records: rows.length,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCacheW,
      cacheReadTokens: totalCacheR,
      totalTokens: totalInput + totalOutput + totalCacheW + totalCacheR,
      costMicros: totalCostMicros,
      costUsd: usdFromMicros(totalCostMicros),
      costLkr: lkrFromMicros(totalCostMicros),
    },
    byModel: Object.entries(byModel).map(([model, v]) => ({
      model,
      calls: v.calls,
      input: v.input,
      output: v.output,
      costUsd: usdFromMicros(v.cost_micros),
    })).sort((a, b) => b.costUsd - a.costUsd),
    seriesLabel,
    series,
    recent: rows.slice(0, 50).map((r) => ({
      id: r.id,
      model: r.model,
      input: r.input_tokens,
      output: r.output_tokens,
      cacheCreation: r.cache_creation_tokens,
      cacheRead: r.cache_read_tokens,
      costUsd: usdFromMicros(Number(r.cost_usd_micros) || 0),
      twilio_call_sid: r.twilio_call_sid,
      at: r.occurred_at,
    })),
  });
}
