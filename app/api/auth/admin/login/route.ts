import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, createToken, SENTINEL_COOKIE, SENTINEL_MAX_AGE } from "@/lib/adminAuth";
import { clientIp, consumeLoginAttempt, refundLoginAttempt } from "@/lib/rateLimit";
import { isDbConfigured } from "@/lib/adminDb";

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

  // In production the DB — and therefore the login rate limiter — must be
  // available. If it somehow isn't, refuse admin login rather than let the env
  // bootstrap-admin path be brute-forced with no throttle at all. Outside
  // production the bootstrap path stays available (unthrottled) for local dev.
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && !isDbConfigured()) {
    return NextResponse.json({ message: "Login temporarily unavailable." }, { status: 503 });
  }

  // Throttle brute-force attempts against the admin console — atomic count so a
  // burst of parallel guesses can't slip past a stale read.
  const ip = clientIp(req);
  const rl = await consumeLoginAttempt("admin", ip);
  if (rl.limited) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  if (!(await checkCredentials(body.email, body.password))) {
    // Wrong credentials — leave this attempt counted against the cap.
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }
  await refundLoginAttempt("admin", ip);
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
