import crypto from "crypto";
import {
  getSql,
  findClientById,
  parseAllowedFeatures,
  type Sql,
  type ClientFeatureKey,
} from "./adminDb";
import { hashPassword } from "./passwords";

// A person who logs into a client's portal. One unified table: the client
// "owner/admin" is simply a row with is_admin = true (created by the admin
// portal when a client is onboarded). See docs/rbac-design.md.
export type ClientUser = {
  id: string;
  client_id: string;
  email: string;
  name: string | null;
  password_hash: string;
  is_admin: boolean;
  allowed_features: string; // CSV subset of the company's plan
  status: string; // 'invited' | 'active' | 'disabled'
  created_by: string | null;
  created_at: string;
  last_login_at: string | null;
};

let ensured = false;
export async function ensureClientUserTable(sql: Sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_client_user (
    id text PRIMARY KEY,
    client_id text NOT NULL,
    email text NOT NULL,
    name text,
    password_hash text NOT NULL DEFAULT '',
    is_admin boolean NOT NULL DEFAULT false,
    allowed_features text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'invited',
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  )`;
  // Email is the login identity, so it is globally unique across client users
  // (a person is one login). Case-insensitive.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS sentinel_client_user_email_idx ON sentinel_client_user (lower(email))`;
  await sql`CREATE INDEX IF NOT EXISTS sentinel_client_user_client_idx ON sentinel_client_user (client_id)`;
  ensured = true;
}

async function audit(sql: Sql, action: string, target: string, summary: string) {
  try {
    await sql`INSERT INTO sentinel_audit (id, admin_name, action, type, target, summary)
      VALUES (${"aud_" + crypto.randomBytes(8).toString("hex")}, ${"Client"}, ${action}, ${"client_user"}, ${target}, ${summary})`;
  } catch {
    /* audit is best-effort */
  }
}

// Effective features a user may see = the company's plan ∩ the user's grants.
// Admins always get the full company plan. This is the single source of truth
// for "what can this user access" and must be used by every gate.
export async function effectiveFeatures(user: Pick<ClientUser, "client_id" | "is_admin" | "allowed_features">): Promise<Set<ClientFeatureKey>> {
  const client = await findClientById(user.client_id);
  const companyFeatures = parseAllowedFeatures(client?.allowed_features);
  if (user.is_admin) return companyFeatures;
  const userFeatures = parseAllowedFeatures(user.allowed_features);
  // Intersection — a user can never exceed the company's plan.
  return new Set([...userFeatures].filter((f) => companyFeatures.has(f)));
}

export async function findClientUserByEmail(email: string): Promise<ClientUser | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureClientUserTable(sql);
  const rows = (await sql`SELECT * FROM sentinel_client_user WHERE lower(email) = ${email.toLowerCase()} LIMIT 1`) as ClientUser[];
  return rows[0] ?? null;
}

export async function findClientUserById(id: string): Promise<ClientUser | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureClientUserTable(sql);
  const rows = (await sql`SELECT * FROM sentinel_client_user WHERE id = ${id} LIMIT 1`) as ClientUser[];
  return rows[0] ?? null;
}

// Scoped to a company. Never returns password_hash to callers that don't need it,
// but callers here are server-side admin APIs, so the row is returned whole and
// the API layer strips secrets before serializing.
export async function listClientUsers(clientId: string): Promise<ClientUser[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureClientUserTable(sql);
  return (await sql`SELECT * FROM sentinel_client_user WHERE client_id = ${clientId} ORDER BY is_admin DESC, created_at ASC`) as ClientUser[];
}

// Normalize a requested feature CSV to only-valid keys, then store as CSV.
function normalizeFeatures(features: string[] | undefined): string {
  if (!features) return "";
  const valid = new Set(parseAllowedFeatures(features.join(",")));
  return [...valid].join(",");
}

export async function createClientUser(input: {
  clientId: string;
  email: string;
  name?: string | null;
  password?: string; // optional — omit to create in "invited" state (set via link)
  isAdmin?: boolean;
  allowedFeatures?: string[];
  createdBy: string | null;
}): Promise<{ ok: true; user: ClientUser } | { ok: false; reason: "duplicate" | "invalid" }> {
  const sql = getSql();
  if (!sql) return { ok: false, reason: "invalid" };
  await ensureClientUserTable(sql);

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, reason: "invalid" };
  if (input.password !== undefined && input.password.length < 8) return { ok: false, reason: "invalid" };

  const existing = await findClientUserByEmail(email);
  if (existing) return { ok: false, reason: "duplicate" };

  const id = "cusr_" + crypto.randomBytes(9).toString("hex");
  const passwordHash = input.password ? hashPassword(input.password) : "";
  const status = input.password ? "active" : "invited";
  const isAdmin = !!input.isAdmin;
  // Admins carry no explicit feature list (they always get the full plan).
  const features = isAdmin ? "" : normalizeFeatures(input.allowedFeatures);

  try {
    const rows = (await sql`INSERT INTO sentinel_client_user
      (id, client_id, email, name, password_hash, is_admin, allowed_features, status, created_by)
      VALUES (${id}, ${input.clientId}, ${email}, ${input.name ?? null}, ${passwordHash}, ${isAdmin}, ${features}, ${status}, ${input.createdBy})
      RETURNING *`) as ClientUser[];
    await audit(sql, "client_user.create", input.clientId, `Created portal user ${email}${isAdmin ? " (admin)" : ""}`);
    return { ok: true, user: rows[0] };
  } catch {
    // Unique index race — treat as duplicate.
    return { ok: false, reason: "duplicate" };
  }
}

// Update a user, strictly scoped to the caller's company. Returns null if the
// target isn't in that company (so callers get a 404, never cross-tenant writes).
export async function updateClientUser(
  clientId: string,
  userId: string,
  patch: { name?: string | null; isAdmin?: boolean; allowedFeatures?: string[]; status?: string; password?: string }
): Promise<ClientUser | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureClientUserTable(sql);

  const target = (await sql`SELECT * FROM sentinel_client_user WHERE id = ${userId} AND client_id = ${clientId} LIMIT 1`) as ClientUser[];
  const current = target[0];
  if (!current) return null;

  const name = patch.name !== undefined ? patch.name : current.name;
  const isAdmin = patch.isAdmin !== undefined ? patch.isAdmin : current.is_admin;
  const status = patch.status !== undefined ? patch.status : current.status;
  const features = patch.allowedFeatures !== undefined ? normalizeFeatures(patch.allowedFeatures) : current.allowed_features;
  const passwordHash = patch.password ? hashPassword(patch.password) : current.password_hash;

  const rows = (await sql`UPDATE sentinel_client_user
    SET name = ${name}, is_admin = ${isAdmin}, allowed_features = ${isAdmin ? "" : features},
        status = ${status}, password_hash = ${passwordHash}
    WHERE id = ${userId} AND client_id = ${clientId}
    RETURNING *`) as ClientUser[];
  if (rows[0]) await audit(sql, "client_user.update", clientId, `Updated portal user ${rows[0].email}`);
  return rows[0] ?? null;
}

// Count admins in a company (used to prevent removing/demoting the last admin,
// which would leave the company with nobody able to manage users).
export async function countActiveAdmins(clientId: string): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;
  await ensureClientUserTable(sql);
  const rows = (await sql`SELECT count(*)::int AS n FROM sentinel_client_user
    WHERE client_id = ${clientId} AND is_admin = true AND status != 'disabled'`) as { n: number }[];
  return rows[0]?.n ?? 0;
}

// Set a user's password (used by the invite / set-password token flow). Marks
// the account active. Not scoped to a company on purpose — the token itself is
// the authorization, and it resolves to exactly one user.
export async function setClientUserPassword(userId: string, password: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await ensureClientUserTable(sql);
  const rows = (await sql`UPDATE sentinel_client_user
    SET password_hash = ${hashPassword(password)}, status = 'active'
    WHERE id = ${userId} RETURNING id`) as { id: string }[];
  return !!rows[0];
}

export async function touchClientUserLogin(userId: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`UPDATE sentinel_client_user SET last_login_at = now() WHERE id = ${userId}`;
}
