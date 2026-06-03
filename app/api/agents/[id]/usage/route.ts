import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { findAgentById, isDbConfigured, recordTokenUsage } from "@/lib/adminDb";
import { costMicros } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Constant-time string compare without throwing on length mismatch.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// POST /api/agents/[id]/usage  (called by the agent's backend)
// Header: x-api-key: <agent.ingest_key>
// Body:
//   {
//     "model": "claude-sonnet-4-6",
//     "input_tokens":  1234,
//     "output_tokens": 567,
//     "cache_creation_tokens": 0,
//     "cache_read_tokens": 0,
//     "twilio_call_sid": "CAxxxx",          // optional
//     "request_id": "msg_xxxxxxx",           // optional, used as the row id for idempotent retries
//     "occurred_at": "2026-06-02T12:34:56Z"  // optional
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
    model?: string;
    input_tokens?: number; output_tokens?: number;
    cache_creation_tokens?: number; cache_read_tokens?: number;
    twilio_call_sid?: string;
    request_id?: string;
    occurred_at?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const model = (body.model || "").trim();
  const input_tokens = Math.max(0, Number(body.input_tokens) || 0);
  const output_tokens = Math.max(0, Number(body.output_tokens) || 0);
  const cache_creation_tokens = Math.max(0, Number(body.cache_creation_tokens) || 0);
  const cache_read_tokens = Math.max(0, Number(body.cache_read_tokens) || 0);
  if (!model) return NextResponse.json({ message: "model is required" }, { status: 400 });
  if (input_tokens === 0 && output_tokens === 0 && cache_creation_tokens === 0 && cache_read_tokens === 0) {
    return NextResponse.json({ message: "At least one of input_tokens / output_tokens must be > 0" }, { status: 400 });
  }

  const cost = costMicros(model, { input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens });
  const id = (body.request_id && body.request_id.trim()) || ("usg_" + crypto.randomBytes(10).toString("hex"));
  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  if (isNaN(occurredAt.getTime())) return NextResponse.json({ message: "Invalid occurred_at" }, { status: 400 });

  const { inserted } = await recordTokenUsage({
    id,
    agentId: agent.id,
    clientId: agent.client_id,
    model,
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    cacheCreationTokens: cache_creation_tokens,
    cacheReadTokens: cache_read_tokens,
    costMicros: cost,
    twilioCallSid: body.twilio_call_sid || null,
    occurredAt,
  });

  return NextResponse.json({
    ok: true,
    id,
    duplicate: !inserted,
    cost_usd: cost / 1_000_000,
    cost_micros: cost,
  });
}
