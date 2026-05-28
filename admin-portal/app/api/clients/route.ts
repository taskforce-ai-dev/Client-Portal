import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient, listClients } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ clients: await listClients() });
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { name?: string; company?: string; email?: string; password?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }
  const existing = (await listClients()).find((c) => c.email === body.email!.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "A client with that email already exists" }, { status: 409 });
  }
  const client = await createClient({
    name: body.name,
    company: body.company || body.name,
    email: body.email,
    password: body.password,
    status: (body.status as "trial" | "active" | "suspended") ?? "trial",
  });
  return NextResponse.json({ client });
}
