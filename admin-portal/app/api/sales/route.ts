import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSale } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { agentId?: string; amount?: number; currency?: string; description?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.agentId || !body.amount) {
    return NextResponse.json({ error: "agentId and amount are required" }, { status: 400 });
  }
  const sale = await createSale({
    agentId: body.agentId,
    amount: Number(body.amount),
    currency: body.currency,
    description: body.description || "Sale",
    date: body.date,
  });
  return NextResponse.json({ sale });
}
