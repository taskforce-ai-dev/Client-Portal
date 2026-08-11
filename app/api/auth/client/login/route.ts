import { NextRequest, NextResponse } from "next/server";
import { CLIENT_COOKIE, CLIENT_MAX_AGE, createClientToken, createClientUserToken } from "@/lib/clientAuth";
import { findClientByEmail, findClientById, isDbConfigured } from "@/lib/adminDb";
import { findClientUserByEmail, touchClientUserLogin } from "@/lib/clientUsers";
import { verifyPassword } from "@/lib/passwords";
import { clientIp, consumeLoginAttempt, refundLoginAttempt } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: CLIENT_MAX_AGE,
};

function statusMessage(status: string): string {
  return status === "pending"
    ? "Your account is pending approval. Contact your account manager."
    : status === "suspended"
      ? "Your account is temporarily suspended. Contact support."
      : status === "invited"
        ? "Finish setting your password from the invite link before signing in."
        : "Portal access is disabled for this account. Contact support.";
}

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
  if (!isDbConfigured()) {
    return NextResponse.json({ message: "Login is not available yet — the database isn't connected." }, { status: 503 });
  }

  // Atomically count this attempt before verifying, so a parallel burst from one
  // IP can't all slip past a stale read.
  const ip = clientIp(req);
  const rl = await consumeLoginAttempt("client", ip);
  if (rl.limited) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  // --- Preferred path: per-user (RBAC) login. A client's people log in here. ---
  const user = await findClientUserByEmail(body.email);
  if (user) {
    if (!user.password_hash || !verifyPassword(body.password, user.password_hash)) {
      // Wrong credentials (or invite not yet accepted) — leave counted.
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }
    if (user.status !== "active") {
      // Correct password but not active — do NOT refund (throttle probing).
      return NextResponse.json({ message: statusMessage(user.status) }, { status: 403 });
    }
    await refundLoginAttempt("client", ip);
    await touchClientUserLogin(user.id);
    const company = (await findClientById(user.client_id))?.company ?? null;
    const res = NextResponse.json({ ok: true, company });
    res.cookies.set(CLIENT_COOKIE, createClientUserToken(user.id, user.client_id), cookieOpts);
    return res;
  }

  // --- Legacy company login (pre-RBAC). Kept until every client has users. ---
  const client = await findClientByEmail(body.email);
  if (!client || !verifyPassword(body.password, client.password_hash)) {
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }
  if (client.status !== "active") {
    return NextResponse.json({ message: statusMessage(client.status) }, { status: 403 });
  }
  await refundLoginAttempt("client", ip);
  const res = NextResponse.json({ ok: true, company: client.company });
  res.cookies.set(CLIENT_COOKIE, createClientToken(client.id), cookieOpts);
  return res;
}
