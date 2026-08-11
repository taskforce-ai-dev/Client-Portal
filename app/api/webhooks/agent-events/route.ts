import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { isDbConfigured, recordAgentCallEvent } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.join(", ");
  return null;
}

function asInt(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  }
  return null;
}

function asDate(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function getPath<T extends Record<string, unknown>>(obj: T | null | undefined, path: string): unknown {
  const parts = path.split(".");
  let node: unknown = obj;
  for (const part of parts) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function pick<T extends Record<string, unknown>>(obj: T | null | undefined, paths: string[]): unknown {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const provided = req.headers.get("x-aether-secret") || "";
  const expected = process.env.AGENT_EVENTS_SECRET || "";
  if (!provided) return NextResponse.json({ message: "Missing x-aether-secret header" }, { status: 401 });
  if (!expected) return NextResponse.json({ message: "Missing AGENT_EVENTS_SECRET" }, { status: 500 });
  if (!safeEqual(provided, expected)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = asString(pick(body, ["eventType"]));
  if (!eventType) return NextResponse.json({ message: "eventType is required" }, { status: 400 });

  const raw = body;
  const source = asString(pick(body, ["source"])) || "unknown";
  const eventAgentId = asString(pick(body, ["agent.id", "agentId", "agent_id"]));
  const eventCallSid = asString(pick(body, ["call.id", "callSid", "call_sid", "sid"]));
  const caller = asString(pick(body, [
    "contact",
    "caller",
    "call.contact",
    "call.from",
    "call.phone",
    "caller_phone",
    "phone",
    "phoneNumber",
    "to",
  ]));
  const durationSeconds = asInt(pick(body, [
    "durationSeconds",
    "duration_seconds",
    "durationSec",
    "call.durationSec",
    "call.duration_seconds",
    "call.duration",
  ]));
  const outcome = asString(pick(body, ["outcome", "call.outcome", "status", "result"]));
  const summary = asString(pick(body, ["summary", "call.summary", "description", "message"]));
  const guestName = asString(pick(body, [
    "guest_name",
    "guestName",
    "call.metadata.guest_name",
  ]));
  const checkIn = asDate(pick(body, [
    "check_in",
    "checkIn",
    "booking_check_in",
    "call.metadata.check_in",
    "call.metadata.checkin",
    "call.metadata.checkIn",
  ]));
  const checkOut = asDate(pick(body, [
    "check_out",
    "checkOut",
    "booking_check_out",
    "call.metadata.check_out",
    "call.metadata.checkout",
    "call.metadata.checkOut",
  ]));
  const room = asString(pick(body, [
    "room",
    "roomName",
    "call.metadata.room",
    "call.metadata.room_preference",
  ]));
  const occurredAt = asDate(pick(body, ["occurredAt", "occurred_at", "timestamp", "time", "eventTime"])) || new Date().toISOString();

  await recordAgentCallEvent({
    eventType,
    agentId: eventAgentId,
    source,
    callSid: eventCallSid,
    caller,
    durationSeconds,
    outcome,
    summary,
    guestName,
    checkIn,
    checkOut,
    room,
    raw,
    receivedAt: new Date(occurredAt),
  });

  return NextResponse.json({ ok: true });
}

