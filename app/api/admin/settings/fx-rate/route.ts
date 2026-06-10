import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { isDbConfigured, setSetting } from "@/lib/adminDb";
import {
  FX_DEFAULT,
  FX_SETTING_KEY,
  FX_SOURCE_KEY,
  FX_UPDATED_KEY,
  getUsdToLkrSnapshot,
} from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const snap = await getUsdToLkrSnapshot();
  return NextResponse.json({
    key: FX_SETTING_KEY,
    rate: snap.rate,
    source: snap.source,
    updatedAt: snap.updatedAt,
    fallback: FX_DEFAULT,
  });
}

// Body: { rate?: number, source?: "auto" | "manual" }
// • { source: "auto" } switches back to daily auto-refresh (cache is
//   invalidated so the next read triggers a fresh fetch).
// • { rate: <n>, source: "manual" } (or just { rate }) pins a manual rate.
// • { rate: <n> } alone defaults to source = "manual".
export async function PATCH(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { rate?: number; source?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ message: "Invalid request body" }, { status: 400 }); }

  const wantsAuto = body.source === "auto";
  if (wantsAuto) {
    // Invalidate cache so next read triggers a live refresh. Keep the
    // numeric value around as a fallback in case the live fetch fails.
    await setSetting(FX_SOURCE_KEY, "auto");
    await setSetting(FX_UPDATED_KEY, "1970-01-01T00:00:00.000Z");
    const snap = await getUsdToLkrSnapshot();
    return NextResponse.json({ ok: true, rate: snap.rate, source: snap.source, updatedAt: snap.updatedAt });
  }

  const n = Number(body.rate);
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ message: "rate must be a positive number" }, { status: 400 });
  }
  await Promise.all([
    setSetting(FX_SETTING_KEY, String(n)),
    setSetting(FX_SOURCE_KEY, "manual"),
    setSetting(FX_UPDATED_KEY, new Date().toISOString()),
  ]);
  return NextResponse.json({ ok: true, rate: n, source: "manual", updatedAt: new Date().toISOString() });
}
