import { NextResponse } from "next/server";
import { getClientSession } from "./clientAuth";
import {
  findAgentForClient,
  findClientById,
  isDbConfigured,
  type DbAgent,
  type DbClient,
} from "./adminDb";

// Shared authorization guard for client-data API routes.
//
// middleware.ts only checks that a cookie is *present*; it does not verify the
// signature and it does not check ownership. The page layout
// (app/agents/[id]/layout.tsx) does the real check, but that only protects
// server-rendered pages — it does nothing for `fetch()` calls to /api routes.
// These helpers apply the same rules the layout applies, so a valid session for
// Client A cannot read/write Client B's agent by calling the API directly, and
// a client whose account was disabled loses API access immediately (bounded
// further by the 24h cookie expiry, since there is no revocation list).
//
// Usage:
//   const guard = await requireAgentOwnership(params.id);
//   if (guard.error) return guard.error;
//   const { client, agent } = guard;

type GuardErr = { error: NextResponse };
type ClientOk = { error: null; client: DbClient };
type AgentOk = { error: null; client: DbClient; agent: DbAgent };

function deny(status: number, message: string): GuardErr {
  return { error: NextResponse.json({ message }, { status }) };
}

// Verify the signed client cookie, load the client, and reject anything that is
// not an active account. Returns the resolved client or a ready-to-return
// error response.
export async function requireClientSession(): Promise<ClientOk | GuardErr> {
  if (!isDbConfigured()) return deny(503, "Database not connected.");

  const session = getClientSession();
  if (!session) return deny(401, "Unauthorized");

  const client = await findClientById(session.clientId);
  // Cookie may still be cryptographically valid, but the account can have been
  // deleted, suspended, or had portal access revoked since it was issued.
  if (!client || client.status !== "active") return deny(403, "Forbidden");

  return { error: null, client };
}

// Everything requireClientSession does, plus: the resolved client must own the
// given agent. Non-ownership and non-existence return the same 403 so we don't
// leak which agent ids exist.
export async function requireAgentOwnership(agentId: string): Promise<AgentOk | GuardErr> {
  const base = await requireClientSession();
  if (base.error) return base;

  const agent = await findAgentForClient(agentId, base.client.id);
  if (!agent) return deny(403, "Forbidden");

  return { error: null, client: base.client, agent };
}
