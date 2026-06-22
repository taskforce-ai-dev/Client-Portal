import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { findAgentById, isDbConfigured, recordMetaInquiry } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Pick the first non-empty / non-null value from a list of aliases. Lets us
// accept whatever naming convention the n8n workflow happens to emit.
function pick<T = unknown>(body: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return null;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    return ["true", "yes", "1", "y"].includes(v.toLowerCase().trim());
  }
  return false;
}

function normalisePlatform(v: unknown): "instagram" | "facebook" | "whatsapp" | null {
  const s = asString(v)?.toLowerCase().trim();
  if (!s) return null;
  if (/instagram|ig\b|insta/.test(s)) return "instagram";
  if (/facebook|fb\b|messenger/.test(s)) return "facebook";
  if (/whatsapp|wa\b/.test(s)) return "whatsapp";
  if (s === "instagram" || s === "facebook" || s === "whatsapp") return s;
  return null;
}

// POST /api/agents/[id]/meta-inquiries
// Header: x-api-key: <agent.ingest_key>
//
// Required body fields:
//   platform                "instagram" | "facebook" | "whatsapp"
//   summary                 (aliases: summary_text, conversation_summary)
//   sender_id               (aliases: senderId, customer_id, ig_sender_id)
//
// Optional:
//   customer_handle         IG/FB handle or WhatsApp number-as-shown
//                           (aliases: handle, username, customer_username)
//   captured_name           Name customer gave at handover
//   captured_contact        WhatsApp number captured at handover
//   property_interest       Short label like "P30 — Office Space Colombo 3"
//   handover                boolean — did HANDOVER_TO_AGENT fire?
//   outcome                 "Handed over" | "In progress" | "Closed" (free text OK)
//   transcript              Full conversation log
//   duration_sec            How long the conversation lasted
//   occurred_at             ISO timestamp; defaults to now
//   request_id              Idempotency key; defaults to a hash of sender_id+conversation
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

  // Unwrap a level if n8n wrapped it
  if (body && typeof body === "object" && !body.summary && !body.platform) {
    const inner = body.data || body.json || body.body;
    if (inner && typeof inner === "object") body = inner as Record<string, unknown>;
  }

  // -------- Required --------
  const platform = normalisePlatform(pick(body, ["platform", "channel", "source"]));
  if (!platform) return NextResponse.json({ message: "platform is required (instagram | facebook | whatsapp)" }, { status: 400 });

  const summary = (asString(pick(body, ["summary", "summary_text", "conversation_summary", "ai_summary"])) || "").trim();
  if (!summary) return NextResponse.json({ message: "summary is required" }, { status: 400 });

  const senderId = asString(pick(body, ["sender_id", "senderId", "customer_id", "ig_sender_id", "user_id"]));
  if (!senderId) return NextResponse.json({ message: "sender_id is required" }, { status: 400 });

  // -------- Optional --------
  const customerHandle = asString(pick(body, ["customer_handle", "handle", "username", "customer_username", "sender_username", "ig_handle"]));
  const capturedName = asString(pick(body, ["captured_name", "name", "customer_name", "lead_name"]));
  const capturedContact = asString(pick(body, ["captured_contact", "contact", "whatsapp", "whatsapp_number", "phone", "customer_phone", "lead_phone"]));
  const propertyInterest = asString(pick(body, ["property_interest", "interest", "property", "interested_in"]));
  const handover = asBool(pick(body, ["handover", "handover_triggered", "is_handover", "handed_over"]));
  const outcome = asString(pick(body, ["outcome", "status", "conversation_status"])) || (handover ? "Handed over" : "In progress");
  const transcript = asString(pick(body, ["transcript", "full_transcript", "conversation"]));
  const durationSec = asInt(pick(body, ["duration_sec", "duration", "conversation_duration"]));
  const occurredAtRaw = asString(pick(body, ["occurred_at", "occurredAt", "ended_at", "timestamp"]));
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
  if (isNaN(occurredAt.getTime())) return NextResponse.json({ message: "Invalid occurred_at" }, { status: 400 });

  // Stable idempotency key: callers can pass request_id; else we derive
  // one from platform+sender+date so repeated POSTs from the same n8n
  // execution don't create duplicates.
  const explicitId = asString(pick(body, ["request_id", "requestId", "id"]));
  const derivedId = "mi_" + crypto
    .createHash("sha1")
    .update(`${platform}|${senderId}|${occurredAt.toISOString().slice(0, 16)}`)
    .digest("hex")
    .slice(0, 20);
  const id = explicitId || derivedId;

  const { inserted } = await recordMetaInquiry({
    id,
    agentId: agent.id,
    clientId: agent.client_id,
    platform,
    senderId,
    customerHandle,
    capturedName,
    capturedContact,
    propertyInterest,
    summary,
    transcript,
    durationSec,
    handover,
    outcome,
    occurredAt,
  });

  return NextResponse.json({
    ok: true,
    id,
    inserted, // false = the row was updated rather than created (idempotent retry)
    stored: {
      platform,
      sender_id: senderId,
      handover,
      captured_name: capturedName,
      captured_contact: capturedContact,
    },
  });
}
