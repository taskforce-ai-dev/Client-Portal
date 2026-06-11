import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { deleteClient, findClientById, isDbConfigured, listAgentsByClient, updateClient } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const client = await findClientById(params.id);
  if (!client) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const agents = await listAgentsByClient(client.id);
  return NextResponse.json({
    id: client.id,
    company: client.company,
    email: client.email,
    contact: client.contact,
    plan: client.plan,
    status: client.status,
    mrr_cents: client.mrr_cents,
    created_at: client.created_at,
    agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role, type: a.type, status: a.status, channels: a.channels })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { company?: string; contact?: string; email?: string; plan?: string; status?: string; mrr_cents?: number; country?: string; allowed_features?: string | string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  try {
    const updated = await updateClient(params.id, {
      company: body.company,
      contact: body.contact,
      email: body.email,
      plan: body.plan,
      status: body.status,
      mrrCents: body.mrr_cents,
      country: body.country,
      allowedFeatures: body.allowed_features,
    });
    if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = /unique|duplicate/i.test(msg) ? 409 : 500;
    return NextResponse.json({ message: status === 409 ? "That email is already in use" : msg }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const ok = await deleteClient(params.id);
  if (!ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
