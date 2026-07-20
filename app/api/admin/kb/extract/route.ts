import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { convertUploadedFile } from "@/lib/kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/kb/extract
// Accepts a multipart file upload (.md/.txt/.pdf/.docx) and returns the
// extracted text as { filename, markdown }. Does NOT persist anything — the
// admin KB editor inserts the returned text into the agent's editor so the
// admin can review before saving. Text files are read directly; PDF/DOCX are
// routed through the external converter (KB_API_URL).
export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing 'file' upload" }, { status: 400 });
  }

  const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "File too large (max 15 MB)" }, { status: 413 });
  }

  try {
    const { filename, markdown } = await convertUploadedFile(file);
    return NextResponse.json({ filename, markdown });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : String(e) },
      { status: 422 }
    );
  }
}
