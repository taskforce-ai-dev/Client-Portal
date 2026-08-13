// Call-data source for the client portal.
//
// The portal's voice line runs on **TaskForce Link** (SmartPBX), which pushes
// per-call events to /api/webhooks/agent-events -> `agent_call_events`. This
// module reads those events and maps them into the exact `DisplayCall` shape
// the rest of the app already consumes, so every page (Call Log, Overview,
// Analytics, Billing) is fed from TaskForce Link without any UI change.
//
// The legacy Twilio reader (lib/twilio.ts) is no longer called by the client
// portal or billing; it's kept only so the admin console keeps compiling until
// its own Twilio surfaces are removed.

import { listAgentCallEvents, type DbAgentCallEvent } from "./adminDb";
import { formatTs, type DisplayCall, type CallsResult } from "./twilio";

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

// Collapse the raw event stream into one row per call. A single call can emit
// several events (e.g. started, then completed); we keep, per call, the richest
// one — greatest duration, tie-broken by most recent received_at — so analytics
// and billing never double-count a call.
//
// The dedup key is the provider call id when present. TaskForce Link may omit
// it, so we fall back to `caller|received_at`: events for the same call still
// collapse instead of each being counted (and billed) separately. Two genuinely
// distinct calls would only merge if they shared caller AND exact timestamp,
// which doesn't happen in practice.
function dedupeEvents(events: DbAgentCallEvent[]): DbAgentCallEvent[] {
  const byKey = new Map<string, DbAgentCallEvent>();
  for (const e of events) {
    // Only rows that describe an actual call (have a duration, outcome, or
    // summary); pure status pings are ignored so they don't inflate counts.
    if (e.duration_seconds == null && !e.outcome && !e.summary) continue;
    const key = e.call_sid || `${e.caller ?? "?"}|${e.received_at}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, e); continue; }
    const better =
      (e.duration_seconds ?? 0) > (prev.duration_seconds ?? 0) ||
      ((e.duration_seconds ?? 0) === (prev.duration_seconds ?? 0) &&
        new Date(e.received_at).getTime() > new Date(prev.received_at).getTime());
    if (better) byKey.set(key, e);
  }
  return [...byKey.values()];
}

function eventToDisplayCall(e: DbAgentCallEvent): DisplayCall {
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
    // Per-call sentiment lives on the AI summary row (joined by the pages when
    // they need it); the call record itself carries none — same as the old
    // Twilio path, which always set "neutral" here.
    sentiment: "neutral",
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
// Degrades gracefully: on any DB error it resolves with an `error` string (the
// pages render it via SourceBadge/TwilioNotice) instead of throwing and
// crashing the server component, matching the old Twilio reader's behaviour.
export async function getAgentCalls(agentId: string, opts: SourceOpts = {}): Promise<CallsResult> {
  if (!agentId) return { calls: [], configured: false };
  const { startIso, endIso } = toIsoRange(opts);
  try {
    const events = await listAgentCallEvents(agentId, { limit: opts.max ?? 1000, startIso, endIso });
    // Billing/analytics accuracy assumes each call has a stable `call_sid`
    // (TaskForce Link extracts it from call.id/callSid/call_sid/sid). Dedup
    // falls back to caller|received_at when it's missing, which only collapses
    // same-timestamp duplicates — so a real multi-event call with NO id could
    // still be counted twice. That shouldn't happen; if it ever does, this
    // warning surfaces it in the logs so we can enforce call_sid at the webhook.
    const idlessCallEvents = events.filter(
      (e) => !e.call_sid && (e.duration_seconds != null || e.outcome || e.summary)
    ).length;
    if (idlessCallEvents > 0) {
      console.warn(
        `[callSource] ${idlessCallEvents} call event(s) without call_sid for agent ${agentId}; ` +
          `dedup used the caller|received_at fallback. Confirm TaskForce Link sends one billable event per call.`
      );
    }
    const calls = dedupeEvents(events)
      .map(eventToDisplayCall)
      .sort((a, b) => (new Date(b.startedAtIso).getTime() || 0) - (new Date(a.startedAtIso).getTime() || 0));
    return { calls, configured: true };
  } catch (e) {
    return { calls: [], configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}
