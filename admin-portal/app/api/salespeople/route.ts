import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSalesperson, listSalespeople } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ salespeople: await listSalespeople() });
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { name?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.name || !body.email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const salesperson = await createSalesperson({
    name: body.name,
    email: body.email,
    phone: body.phone,
  });
  return NextResponse.json({ salesperson });
}
