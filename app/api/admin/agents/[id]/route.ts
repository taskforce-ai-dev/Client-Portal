import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { deleteAgent, findAgentById, isDbConfigured, updateAgent } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: agent.id, client_id: agent.client_id, name: agent.name, role: agent.role,
    type: agent.type, status: agent.status, channels: agent.channels, description: agent.description,
    twilio_subaccount_sid: agent.twilio_subaccount_sid,
    has_anthropic_api_key: !!agent.anthropic_api_key_enc,
    has_elevenlabs_api_key: !!agent.elevenlabs_api_key_enc,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { name?: string; role?: string; status?: string; type?: string; description?: string; twilio_subaccount_sid?: string; anthropic_api_key?: string; elevenlabs_api_key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  const updated = await updateAgent(params.id, {
    name: body.name,
    role: body.role,
    status: body.status,
    type: body.type,
    description: body.description,
    twilioSubaccountSid: body.twilio_subaccount_sid,
    anthropicApiKey: body.anthropic_api_key,
    elevenlabsApiKey: body.elevenlabs_api_key,
  });
  if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const ok = await deleteAgent(params.id);
  if (!ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
