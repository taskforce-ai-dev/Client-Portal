import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { findAgentById, isDbConfigured, recordCallSummary } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Pick the first non-empty / non-null value from a list of aliases. Lets us
// accept whatever naming convention the n8n / OpenAI workflow happens to
// emit ("booking_confirmed", "is_confirmed", "status", "outcome", etc.).
function pick<T = unknown>(body: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return null;
}

function asDate(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  // Accept YYYY-MM-DD, ISO timestamp, DD/MM/YYYY, or "12 August 2026"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s; // store raw — UI will try to render it
}

// Translate whatever the AI emits into our canonical booking_status.
// Accepts booleans (booking_confirmed: true), enums (status: "won"),
// natural language ("the booking was confirmed"), and our canonical
// strings unchanged.
function normaliseBookingStatus(raw: unknown, fromBoolean?: unknown): string | null {
  if (typeof fromBoolean === "boolean") return fromBoolean ? "confirmed" : null;
  if (typeof fromBoolean === "string") {
    const f = fromBoolean.toLowerCase().trim();
    if (["true", "yes", "1", "y"].includes(f)) return "confirmed";
  }
  const s = asString(raw);
  if (!s) return null;
  const t = s.toLowerCase().trim();
  // Direct canonical match
  if (["confirmed", "inquiry", "cancelled", "no_booking"].includes(t)) return t;
  // Vocabulary
  if (/\b(?:booking\s+confirmed|confirmed|booked|completed|complete|won|success(?:ful)?)\b/.test(t)) return "confirmed";
  if (/\b(?:dropped|hung\s+up|disconnected|abandoned|not\s+interested|wrong\s+number|spam|no[\s-]*booking|lost|cancel(?:led|ation)?|declined|rejected)\b/.test(t)) return "no_booking";
  if (/\b(?:booking\s+inquiry|inquiry|enquiry|information|availability|pending|lead|follow[\s-]*up|interested)\b/.test(t)) return "inquiry";
  return null;
}

// POST /api/agents/[id]/summaries
// Header: x-api-key: <agent.ingest_key>
//
// Body is flexible — we accept multiple naming conventions because n8n /
// OpenAI / Claude / your AI agent may emit fields under different keys.
// The canonical names are listed first; aliases follow.
//
// Required:
//   call_sid               (aliases: call_id, sid, twilio_call_sid)
//   summary                (aliases: summary_text, ai_summary, conversation_summary)
//
// Optional core fields:
//   caller_name            (aliases: callerName, name, customer_name, guest_name)
//   caller_phone           (aliases: callerPhone, phone, customer_phone, from)
//   key_points             (aliases: keyPoints, highlights, main_points)
//   action_items           (aliases: actionItems, next_steps, todos)
//   mentioned_dates        (aliases: dates, mentioned_date_range)
//   sentiment              (aliases: sentiment_label, mood)
//   topics                 (aliases: tags, categories, labels, topic, tag, category)
//   duration_sec           (aliases: duration, call_duration_sec, call_length)
//   transcript             (aliases: full_transcript, conversation_transcript)
//   occurred_at            (aliases: timestamp, call_time, started_at, occurredAt)
//   request_id             (aliases: requestId) — for idempotent retries
//
// Optional booking fields (drive the Conversions tab):
//   booking_status         "confirmed" | "inquiry" | "cancelled" | "no_booking"
//     (also accepts: status, outcome, booking_outcome, call_outcome,
//      conversion, conversion_status, result)
//   booking_confirmed      boolean — true → status="confirmed"
//     (also accepts: is_confirmed, isConfirmed, confirmed)
//   booking_value_lkr      integer LKR
//     (also accepts: total, price, amount, total_amount, total_lkr, value,
//      booking_value, total_price, cost)
//   booking_reference      string
//     (also accepts: confirmation_number, confirmation_code, confirmation,
//      booking_reference, booking_number, booking_id, reservation_id,
//      reservation_number, reference)
//   booking_check_in       YYYY-MM-DD or natural language
//     (also accepts: check_in, checkin, check_in_date, arrival, arrival_date,
//      from_date, start_date)
//   booking_check_out      YYYY-MM-DD or natural language
//     (also accepts: check_out, checkout, check_out_date, departure,
//      departure_date, to_date, end_date)
//   booking_guests         integer
//     (also accepts: guests, num_guests, number_of_guests, guest_count,
//      pax, people, persons, adults, headcount, occupancy)
//   booking_room_type      string
//     (also accepts: room, room_type, unit, unit_type, accommodation,
//      category, villa, suite, chalet, cabin)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const provided = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!provided) return NextResponse.json({ message: "Missing x-api-key header" }, { status: 401 });

  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
  if (!agent.ingest_key || !safeEqual(agent.ingest_key, provided)) {
    return NextResponse.json({ message: "Invalid API key" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  // Some n8n setups wrap the payload in { data: {...} } or { json: {...} }.
  // Unwrap one level if we see that.
  if (body && typeof body === "object" && !body.summary && !body.call_sid) {
    const inner = body.data || body.json || body.body;
    if (inner && typeof inner === "object") body = inner as Record<string, unknown>;
  }

  // -------- Required: summary + call_sid --------
  const summary = (asString(pick(body, ["summary", "summary_text", "ai_summary", "conversation_summary", "call_summary"])) || "").trim();
  if (!summary) return NextResponse.json({ message: "summary is required" }, { status: 400 });

  const callSid = asString(pick(body, ["call_sid", "callSid", "call_id", "callId", "sid", "twilio_call_sid"]));
  if (!callSid) return NextResponse.json({ message: "call_sid is required" }, { status: 400 });

  // -------- Optional core --------
  const callerName = asString(pick(body, ["caller_name", "callerName", "name", "customer_name", "guest_name", "caller"]));
  const callerPhone = asString(pick(body, ["caller_phone", "callerPhone", "phone", "customer_phone", "guest_phone", "from", "from_number", "phone_number"]));
  const keyPoints = asString(pick(body, ["key_points", "keyPoints", "highlights", "main_points", "key_takeaways"]));
  const actionItems = asString(pick(body, ["action_items", "actionItems", "next_steps", "todos", "follow_up_actions"]));
  const mentionedDates = asString(pick(body, ["mentioned_dates", "mentionedDates", "dates", "mentioned_date_range", "dates_discussed"]));
  const sentiment = asString(pick(body, ["sentiment", "sentiment_label", "mood"]));
  const topicsRaw = pick(body, ["topics", "tags", "categories", "labels", "topic", "tag", "category"]);
  const topicsStr = Array.isArray(topicsRaw) ? topicsRaw.map(String).join(", ") : asString(topicsRaw);
  const durationSecRaw = asInt(pick(body, ["duration_sec", "duration", "call_duration_sec", "call_duration", "call_length"]));
  const transcript = asString(pick(body, ["transcript", "full_transcript", "conversation_transcript", "raw_transcript"]));
  const occurredAtRaw = asString(pick(body, ["occurred_at", "occurredAt", "timestamp", "call_time", "started_at", "call_started_at"]));
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  if (isNaN(occurredAt.getTime())) return NextResponse.json({ message: "Invalid occurred_at" }, { status: 400 });
  const id = asString(pick(body, ["request_id", "requestId", "id"])) || callSid || ("sum_" + crypto.randomBytes(10).toString("hex"));

  // -------- Booking fields (status + facts) --------
  const statusRaw = pick(body, [
    "booking_status", "status", "outcome", "booking_outcome", "call_outcome",
    "conversion", "conversion_status", "result", "final_outcome",
  ]);
  const confirmedRaw = pick(body, [
    "booking_confirmed", "is_confirmed", "isConfirmed", "confirmed",
    "is_booking_confirmed", "booking_made",
  ]);
  const bookingStatus = normaliseBookingStatus(statusRaw, confirmedRaw);

  const bookingValueLkr = asInt(pick(body, [
    "booking_value_lkr", "booking_value", "total", "total_lkr", "total_amount",
    "amount", "price", "value", "cost", "total_price", "booking_total",
    "grand_total", "payable",
  ]));

  const bookingReference = asString(pick(body, [
    "booking_reference", "confirmation_number", "confirmation_code",
    "confirmation", "booking_number", "booking_id", "reservation_id",
    "reservation_number", "reference", "reference_number", "ref",
  ]));

  const bookingCheckIn = asDate(pick(body, [
    "booking_check_in", "check_in", "checkIn", "check_in_date", "checkin",
    "arrival", "arrival_date", "from_date", "start_date", "stay_start",
  ]));

  const bookingCheckOut = asDate(pick(body, [
    "booking_check_out", "check_out", "checkOut", "check_out_date", "checkout",
    "departure", "departure_date", "to_date", "end_date", "stay_end",
  ]));

  const bookingGuests = asInt(pick(body, [
    "booking_guests", "guests", "num_guests", "number_of_guests", "guest_count",
    "pax", "people", "persons", "adults", "headcount", "occupancy", "no_of_guests",
  ]));

  const bookingRoomType = asString(pick(body, [
    "booking_room_type", "room_type", "roomType", "room", "unit", "unit_type",
    "accommodation", "accomodation", "category", "villa", "suite", "chalet",
    "cabin", "room_category",
  ]));

  const { inserted } = await recordCallSummary({
    id,
    agentId: agent.id,
    clientId: agent.client_id,
    twilioCallSid: callSid,
    callerName,
    callerPhone,
    summary,
    keyPoints,
    actionItems,
    mentionedDates,
    sentiment,
    topics: topicsStr,
    durationSec: durationSecRaw,
    transcript,
    occurredAt,
    bookingStatus,
    bookingValueLkr,
    bookingReference,
    bookingCheckIn,
    bookingCheckOut,
    bookingGuests,
    bookingRoomType,
  });

  return NextResponse.json({
    ok: true,
    id,
    duplicate: !inserted,
    // Echo what we actually stored so the n8n debug pane is informative.
    parsed: {
      booking_status: bookingStatus,
      booking_value_lkr: bookingValueLkr,
      booking_reference: bookingReference,
      booking_check_in: bookingCheckIn,
      booking_check_out: bookingCheckOut,
      booking_guests: bookingGuests,
      booking_room_type: bookingRoomType,
    },
  });
}
