import { NextRequest, NextResponse } from "next/server";
import { getKbContent, saveKbContent } from "@/lib/kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agentFrom(req: NextRequest) {
  return req.nextUrl.searchParams.get("agent") || "default";
}

export async function GET(req: NextRequest) {
  try {
    const data = await getKbContent(agentFrom(req));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}

export async function PUT(req: NextRequest) {
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "Missing 'content' string" }, { status: 400 });
  }
  try {
    const data = await saveKbContent(agentFrom(req), body.content);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
