import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured, listMetaInquiries } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mirror of the client portal's Meta Inbox page, exposed for the admin
// SPA. Returns the most recent meta-inbox rows for an agent so the
// admin tab can render the same data the client sees in their portal.
//
// Query: ?platform=instagram|facebook|whatsapp|all (default: all)
//        &limit=200 (default 200, max 1000)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const platform = sp.get("platform") || "all";
  const limitRaw = Number(sp.get("limit") || 200);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 200;

  const rows = await listMetaInquiries(agent.id, { platform, limit });

  // Lightweight derived counts so the SPA doesn't have to recompute per-platform
  // totals client-side. Returning the full row set as-is so the SPA can keep
  // its own outcome / search filters cheap.
  const counts = {
    all: rows.length,
    instagram: rows.filter((r) => r.platform === "instagram").length,
    facebook: rows.filter((r) => r.platform === "facebook").length,
    whatsapp: rows.filter((r) => r.platform === "whatsapp").length,
    handed_over: rows.filter((r) => r.handover).length,
    in_progress: rows.filter((r) => !r.handover).length,
    contacts_captured: rows.filter((r) => r.captured_contact).length,
  };

  return NextResponse.json({ rows, counts });
}
