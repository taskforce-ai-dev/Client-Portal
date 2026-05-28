import { NextRequest, NextResponse } from "next/server";
import { convertPdf, isKbServiceConfigured } from "@/lib/kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent") || "default";

  if (!isKbServiceConfigured()) {
    return NextResponse.json(
      { error: "KB service not connected. Set KB_API_URL to enable PDF conversion." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' upload" }, { status: 400 });
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  try {
    const result = await convertPdf(agent, file);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
