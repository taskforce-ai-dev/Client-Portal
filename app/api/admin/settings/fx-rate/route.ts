import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { isDbConfigured, setSetting } from "@/lib/adminDb";
import { FX_DEFAULT, getUsdToLkr, FX_SETTING_KEY } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const rate = await getUsdToLkr();
  return NextResponse.json({ key: FX_SETTING_KEY, rate, fallback: FX_DEFAULT });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { rate?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ message: "Invalid request body" }, { status: 400 }); }
  const n = Number(body.rate);
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ message: "rate must be a positive number" }, { status: 400 });
  }
  await setSetting(FX_SETTING_KEY, String(n));
  return NextResponse.json({ ok: true, rate: n });
}
