import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, createToken, SENTINEL_COOKIE, SENTINEL_MAX_AGE } from "@/lib/adminAuth";
import { clientIp, isLoginRateLimited, recordLoginFailure } from "@/lib/rateLimit";

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

  // Throttle brute-force attempts against the admin console.
  const ip = clientIp(req);
  const rl = await isLoginRateLimited("admin", ip);
  if (rl.limited) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  if (!(await checkCredentials(body.email, body.password))) {
    await recordLoginFailure("admin", ip);
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SENTINEL_COOKIE, createToken(body.email.trim().toLowerCase()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SENTINEL_MAX_AGE,
  });
  return res;
}
