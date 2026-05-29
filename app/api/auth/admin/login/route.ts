import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, createToken, SENTINEL_COOKIE, SENTINEL_MAX_AGE } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
  }
  if (!(await checkCredentials(body.email, body.password))) {
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SENTINEL_COOKIE, createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SENTINEL_MAX_AGE,
  });
  return res;
}
