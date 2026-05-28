import { NextResponse } from "next/server";
import { SENTINEL_COOKIE } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SENTINEL_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
