// Call-data source for the client portal.
//
// The portal's voice line runs on **TaskForce Link** (SmartPBX), which pushes
// per-call events to /api/webhooks/agent-events -> `agent_call_events`. This
// module reads those events and maps them into the exact `DisplayCall` /
// `UsageResult` shapes the rest of the app already consumes, so every page
// (Call Log, Overview, Analytics, Billing, Conversions) is fed from TaskForce
// Link without any UI change.
//
// The legacy Twilio reader (lib/twilio.ts) is no longer called by the client
// portal or billing; it's kept only so the admin console keeps compiling until
// its own Twilio surfaces are removed.

import { listAgentCallEvents, listCallSummaries, type DbAgentCallEvent } from "./adminDb";
import { formatTs, type DisplayCall, type CallsResult, type UsageResult } from "./twilio";

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Normalize whatever outcome string TaskForce Link sends into the portal's
// canonical vocabulary, so the outcome filter chips and the outcome donut
// (bucketOutcomes) keep working. Unknown values are title-cased and passed
// through (same behaviour Twilio's prettyStatus had).
function normalizeOutcome(raw: string | null): string {
  const t = (raw || "").toLowerCase().trim();
  if (!t) return "Completed"; // a call with duration but no explicit status
  if (/\b(complete|completed|success|answered|booked|done)\b/.test(t)) return "Completed";
  if (/\b(no[\s-]*answer|noanswer|missed|unanswered|no[\s-]*response)\b/.test(t)) return "No answer";
  if (/\bbusy\b/.test(t)) return "Busy";
  if (/\b(fail|failed|error|declined|rejected)\b/.test(t)) return "Failed";
  if (/\b(cancel|cancelled|canceled|abandoned)\b/.test(t)) return "Canceled";
  if (/\b(in[\s-]*progress|ongoing|live)\b/.test(t)) return "In progress";
  return raw!.charAt(0).toUpperCase() + raw!.slice(1);
}

function normalizeSentiment(raw: string | null | undefined): DisplayCall["sentiment"] {
  const t = (raw || "").toLowerCase();
  if (t.includes("pos")) return "positive";
  if (t.includes("neg")) return "negative";
  return "neutral";
}

// Collapse the raw event stream into one row per call. A single call can emit
// several events (e.g. started, then completed); we keep, per call_sid, the
// richest one — the greatest duration, tie-broken by most recent received_at —
// so analytics and billing never double-count a call.
function dedupeEvents(events: DbAgentCallEvent[]): DbAgentCallEvent[] {
  const byCall = new Map<string, DbAgentCallEvent>();
  const noKey: DbAgentCallEvent[] = [];
  for (const e of events) {
    // Only rows that describe an actual call (have a duration or an outcome);
    // pure status pings without either are ignored so they don't inflate counts.
    if (e.duration_seconds == null && !e.outcome && !e.summary) continue;
    const key = e.call_sid;
    if (!key) { noKey.push(e); continue; }
    const prev = byCall.get(key);
    if (!prev) { byCall.set(key, e); continue; }
    const better =
      (e.duration_seconds ?? 0) > (prev.duration_seconds ?? 0) ||
      ((e.duration_seconds ?? 0) === (prev.duration_seconds ?? 0) &&
        new Date(e.received_at).getTime() > new Date(prev.received_at).getTime());
    if (better) byCall.set(key, e);
  }
  return [...byCall.values(), ...noKey];
}

function eventToDisplayCall(e: DbAgentCallEvent, sentiment: DisplayCall["sentiment"]): DisplayCall {
  const dur = e.duration_seconds ?? 0;
  const caller = e.caller || e.guest_name || "Unknown";
  return {
    id: e.call_sid || `link-${e.id}`,
    caller,
    number: caller,
    startedAt: formatTs(e.received_at),
    startedAtIso: e.received_at,
    duration: mmss(dur),
    durationSec: dur,
    outcome: normalizeOutcome(e.outcome),
    sentiment,
    // TaskForce Link doesn't distinguish direction; agent calls are inbound.
    direction: "inbound",
    recordingUrl: null,
    // Billing derives cost from duration, not a per-call price, so null here
    // is correct and doesn't affect billing totals.
    twilioPriceUsd: null,
  };
}

type SourceOpts = { max?: number; startDate?: string; endDate?: string };

function toIsoRange(opts: SourceOpts): { startIso?: string; endIso?: string } {
  const out: { startIso?: string; endIso?: string } = {};
  if (opts.startDate) out.startIso = new Date(opts.startDate + "T00:00:00Z").toISOString();
  if (opts.endDate) out.endIso = new Date(opts.endDate + "T00:00:00Z").toISOString();
  return out;
}

// All calls for one agent, newest first. Drop-in replacement for the Twilio
// reader — same CallsResult shape, keyed by agentId instead of a subaccount.
export async function getAgentCalls(agentId: string, opts: SourceOpts = {}): Promise<CallsResult> {
  if (!agentId) return { calls: [], configured: false };
  const { startIso, endIso } = toIsoRange(opts);
  const [events, summaries] = await Promise.all([
    listAgentCallEvents(agentId, { limit: opts.max ?? 1000, startIso, endIso }),
    listCallSummaries(agentId, { limit: 1000 }),
  ]);
  // Sentiment comes from the AI summary pushed via /summaries, joined by call id.
  const sentimentByCall = new Map<string, string>();
  for (const s of summaries) if (s.twilio_call_sid && s.sentiment) sentimentByCall.set(s.twilio_call_sid, s.sentiment);

  const calls = dedupeEvents(events)
    .map((e) => eventToDisplayCall(e, normalizeSentiment(e.call_sid ? sentimentByCall.get(e.call_sid) : undefined)))
    .sort((a, b) => (new Date(b.startedAtIso).getTime() || 0) - (new Date(a.startedAtIso).getTime() || 0));

  return { calls, configured: true };
}

// Usage totals for an agent, derived from the same events. Minutes are raw
// (sum of seconds / 60); the billing rate is applied by lib/billing.ts.
export async function getAgentUsage(agentId: string, opts: SourceOpts = {}): Promise<UsageResult> {
  const { calls, configured, error } = await getAgentCalls(agentId, opts);
  if (!configured) return { configured: false, totalCalls: 0, totalMinutes: 0, totalPrice: 0, error };
  const totalSec = calls.reduce((s, c) => s + c.durationSec, 0);
  return { configured: true, totalCalls: calls.length, totalMinutes: totalSec / 60, totalPrice: 0, error };
}
