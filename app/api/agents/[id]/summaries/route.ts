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

// POST /api/agents/[id]/summaries
// Header: x-api-key: <agent.ingest_key>
// Body:
//   {
//     "call_sid": "CAxxxxxxxxxxxxxxxxxx",
//     "caller_name": "John Smith",
//     "caller_phone": "+94771234567",
//     "summary": "Caller asked about availability for the weekend ...",
//     "key_points": "- Wants weekend booking\n- 3 guests\n- Deluxe room",
//     "action_items": "- Send confirmation\n- Check pet policy",
//     "mentioned_dates": "June 14-15, 2026",
//     "sentiment": "positive",
//     "topics": "booking,pricing",
//     "duration_sec": 154,
//     "occurred_at": "2026-06-02T12:34:56Z",
//     "request_id": "msg_xxx",   // optional — overrides id for idempotent retries
//     // ===== Optional booking fields (drive the Conversions tab) =====
//     "booking_status": "confirmed",   // "confirmed" | "inquiry" | "cancelled" | "no_booking"
//     "booking_value_lkr": 24500,      // total price discussed (integer LKR)
//     "booking_reference": "THC-2026-417",
//     "booking_check_in": "2026-08-12",
//     "booking_check_out": "2026-08-17",
//     "booking_guests": 2,
//     "booking_room_type": "Treetop suite"
//   }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const provided = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!provided) return NextResponse.json({ message: "Missing x-api-key header" }, { status: 401 });

  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
  if (!agent.ingest_key || !safeEqual(agent.ingest_key, provided)) {
    return NextResponse.json({ message: "Invalid API key" }, { status: 403 });
  }

  let body: {
    call_sid?: string;
    caller_name?: string;
    caller_phone?: string;
    summary?: string;
    key_points?: string;
    action_items?: string;
    mentioned_dates?: string;
    sentiment?: string;
    topics?: string | string[];
    duration_sec?: number;
    transcript?: string;
    occurred_at?: string;
    request_id?: string;
    booking_status?: string;
    booking_value_lkr?: number;
    booking_reference?: string;
    booking_check_in?: string;
    booking_check_out?: string;
    booking_guests?: number;
    booking_room_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const summary = (body.summary || "").trim();
  if (!summary) return NextResponse.json({ message: "summary is required" }, { status: 400 });
  if (!body.call_sid) return NextResponse.json({ message: "call_sid is required" }, { status: 400 });

  const topicsStr = Array.isArray(body.topics) ? body.topics.join(",") : (body.topics || null);
  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  if (isNaN(occurredAt.getTime())) return NextResponse.json({ message: "Invalid occurred_at" }, { status: 400 });
  const id = (body.request_id && body.request_id.trim()) || body.call_sid || ("sum_" + crypto.randomBytes(10).toString("hex"));

  const VALID_BOOKING_STATUS = new Set(["confirmed", "inquiry", "cancelled", "no_booking"]);
  const bookingStatus = body.booking_status && VALID_BOOKING_STATUS.has(body.booking_status)
    ? body.booking_status
    : null;
  const bookingValue = typeof body.booking_value_lkr === "number" && Number.isFinite(body.booking_value_lkr) && body.booking_value_lkr >= 0
    ? Math.round(body.booking_value_lkr)
    : null;
  const bookingGuests = typeof body.booking_guests === "number" && Number.isFinite(body.booking_guests) && body.booking_guests > 0
    ? Math.round(body.booking_guests)
    : null;

  const { inserted } = await recordCallSummary({
    id,
    agentId: agent.id,
    clientId: agent.client_id,
    twilioCallSid: body.call_sid || null,
    callerName: body.caller_name || null,
    callerPhone: body.caller_phone || null,
    summary,
    keyPoints: body.key_points || null,
    actionItems: body.action_items || null,
    mentionedDates: body.mentioned_dates || null,
    sentiment: body.sentiment || null,
    topics: topicsStr,
    durationSec: typeof body.duration_sec === "number" ? Math.floor(body.duration_sec) : null,
    transcript: body.transcript || null,
    occurredAt,
    bookingStatus,
    bookingValueLkr: bookingValue,
    bookingReference: body.booking_reference || null,
    bookingCheckIn: body.booking_check_in || null,
    bookingCheckOut: body.booking_check_out || null,
    bookingGuests,
    bookingRoomType: body.booking_room_type || null,
  });

  return NextResponse.json({ ok: true, id, duplicate: !inserted });
}
