import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { createAgent, createClient, isDbConfigured, issueClientOwnerInvite, listClients } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json([]);
  try {
    const clients = await listClients();
    return NextResponse.json(
      clients.map((c) => ({ id: c.id, company: c.company, email: c.email, status: c.status, plan: c.plan }))
    );
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) {
    return NextResponse.json({ message: "Database not connected. Set DATABASE_URL." }, { status: 503 });
  }
  let body: {
    company?: string; email?: string; password?: string; plan?: string; status?: string; contact?: string; mrr_cents?: number;
    country?: string; allowed_features?: string | string[];
    provisionAgent?: boolean; agentName?: string; agentRole?: string; agentChannels?: string; agentTwilioSubaccountSid?: string;
    sendInvite?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body.company || !body.email || !body.password) {
    return NextResponse.json({ message: "Company, email and password are required" }, { status: 400 });
  }
  try {
    const client = await createClient({
      company: body.company,
      email: body.email,
      password: body.password,
      plan: body.plan,
      status: body.status,
      contact: body.contact,
      mrrCents: body.mrr_cents,
      country: body.country,
      allowedFeatures: body.allowed_features,
    });
    if (body.provisionAgent && body.agentName) {
      await createAgent({
        clientId: client.id,
        name: body.agentName,
        role: body.agentRole,
        channels: body.agentChannels,
        twilioSubaccountSid: body.agentTwilioSubaccountSid,
      });
    }

    // RBAC alignment (docs/rbac-design.md): every client gets its first
    // sentinel_client_user (the owner) here. When sending a welcome email,
    // the owner is created "invited" with no password — the admin-typed
    // password above never becomes a real credential for this account; only
    // the token holder sets one. "Create account only" instead activates the
    // owner immediately with that password, matching the pre-RBAC behavior.
    // Best-effort: a user-creation failure (e.g. email already a portal user
    // elsewhere) must not fail client creation — the client row still exists.
    // But it must not be swallowed silently either: once a client_user row
    // exists for an email, findClientUserByEmail() shadows the legacy
    // sentinel_client password for that email in the login route, so a
    // failed owner creation leaves the new client genuinely unable to sign
    // in — ownerCreated is surfaced to the console precisely so that isn't
    // silent.
    let emailSent: boolean | undefined;
    let ownerCreated = true;
    try {
      const { createClientUser } = await import("@/lib/clientUsers");
      const userResult = await createClientUser({
        clientId: client.id,
        email: client.email,
        name: body.contact,
        password: body.sendInvite ? undefined : body.password,
        isAdmin: true,
        allowedFeatures: [],
        createdBy: null,
      });
      if (!userResult.ok) {
        ownerCreated = false;
        console.error("Owner user creation failed for new client " + client.id + ": " + userResult.reason);
      } else if (body.sendInvite) {
        const { sent } = await issueClientOwnerInvite(client.id, req.nextUrl.origin);
        emailSent = sent;
      }
    } catch (e) {
      ownerCreated = false;
      console.error("Owner user / invite setup failed for new client " + client.id + ":", e);
    }

    return NextResponse.json({
      ok: true,
      client: { id: client.id, company: client.company, email: client.email },
      emailSent,
      ownerCreated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = /unique|duplicate/i.test(msg) ? 409 : 500;
    return NextResponse.json(
      { message: status === 409 ? "A client with that email already exists" : msg },
      { status }
    );
  }
}
