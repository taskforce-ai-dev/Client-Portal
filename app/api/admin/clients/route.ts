import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { createClient, isDbConfigured, listClients } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json([]);
  try {
    const clients = await listClients();
    return NextResponse.json(
      clients.map((c) => ({ id: c.id, company: c.company, email: c.email, status: c.status, plan: c.plan }))
    );
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) {
    return NextResponse.json({ message: "Database not connected. Set DATABASE_URL." }, { status: 503 });
  }
  let body: { company?: string; email?: string; password?: string; plan?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body.company || !body.email || !body.password) {
    return NextResponse.json({ message: "Company, email and password are required" }, { status: 400 });
  }
  try {
    const client = await createClient({
      company: body.company,
      email: body.email,
      password: body.password,
      plan: body.plan,
      status: body.status,
    });
    return NextResponse.json({ ok: true, client: { id: client.id, company: client.company, email: client.email } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = /unique|duplicate/i.test(msg) ? 409 : 500;
    return NextResponse.json(
      { message: status === 409 ? "A client with that email already exists" : msg },
      { status }
    );
  }
}
