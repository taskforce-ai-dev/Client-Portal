import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight connectivity check (no sensitive data) to confirm the live
// app can reach Neon and the sentinel_* tables exist.
export async function GET() {
  const databaseUrlSet = !!process.env.DATABASE_URL;
  if (!databaseUrlSet) return NextResponse.json({ databaseUrlSet, ok: false });
  try {
    const { neon } = await import("@neondatabase/serverless");
    const { ensureSeed } = await import("@/lib/adminDb");
    const sql = neon(process.env.DATABASE_URL!);
    await ensureSeed(sql as any);
    const c = (await sql`SELECT count(*)::int AS n FROM sentinel_client`) as Array<{ n: number }>;
    const a = (await sql`SELECT count(*)::int AS n FROM sentinel_admin`) as Array<{ n: number }>;
    let orgs = -1;
    try {
      const o = (await sql`SELECT count(*)::int AS n FROM organization`) as Array<{ n: number }>;
      orgs = o[0]?.n ?? -1;
    } catch {}
    return NextResponse.json({ databaseUrlSet, ok: true, clients: c[0]?.n ?? 0, admins: a[0]?.n ?? 0, organizations: orgs });
  } catch (e) {
    return NextResponse.json({ databaseUrlSet, ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
