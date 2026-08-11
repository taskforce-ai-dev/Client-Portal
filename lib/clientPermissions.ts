import { NextResponse } from "next/server";
import { getClientSession } from "./clientAuth";
import { findClientById, isDbConfigured, type DbClient } from "./adminDb";
import { findClientUserById, type ClientUser } from "./clientUsers";

// A legacy (pre-RBAC) company session has no userId. We represent it as a
// synthetic admin bound to its own company, so existing single-login clients can
// still reach the Team feature and create their first real users. Once a client
// has real users they log in as those users and this path is never hit for them.
function syntheticOwner(client: DbClient): ClientUser {
  return {
    id: `legacy:${client.id}`,
    client_id: client.id,
    email: client.email,
    name: client.company,
    password_hash: "",
    is_admin: true,
    allowed_features: "", // "" = full company plan
    status: "active",
    created_by: null,
    created_at: client.created_at,
    last_login_at: null,
  };
}

// The currently signed-in client user (or the synthetic owner for a legacy
// company session). null when signed out, disabled, or cross-tenant mismatch.
export async function getCurrentClientUser(): Promise<ClientUser | null> {
  const session = getClientSession();
  if (!session) return null;
  if (session.userId) {
    const user = await findClientUserById(session.userId);
    // Defense in depth: the token embeds client_id; it must match the row.
    if (!user || user.status === "disabled" || user.client_id !== session.clientId) return null;
    return user;
  }
  const client = await findClientById(session.clientId);
  if (!client || client.status !== "active") return null;
  return syntheticOwner(client);
}

type GuardErr = { error: NextResponse };
type AdminOk = { error: null; user: ClientUser };

// API guard: only an active admin of a company may manage its users.
export async function requireClientAdmin(): Promise<AdminOk | GuardErr> {
  if (!isDbConfigured()) return { error: NextResponse.json({ message: "Database not connected." }, { status: 503 }) };
  const session = getClientSession();
  if (!session) return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  const user = await getCurrentClientUser();
  if (!user || !user.is_admin || user.status !== "active") {
    return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }
  return { error: null, user };
}
