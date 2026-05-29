import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import { hashPassword, encryptSecret, decryptSecret } from "./passwords";

// Additive schema: admins + clients live in sentinel_* tables. Your Better
// Auth tables (organization, user, member, …) are never touched.

export function isDbConfigured() {
  return !!process.env.DATABASE_URL;
}

export function getSql() {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
}

export type Sql = NonNullable<ReturnType<typeof getSql>>;

export type DbClient = {
  id: string;
  company: string;
  email: string;
  password_enc: string | null; // AES-GCM encrypted; revealable by an authed admin
  password_hash: string;
  status: string;
  plan: string;
  mrr_cents: number;
  contact: string | null;
  created_at: string;
};

export type DbAdmin = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

let ensured = false;

export async function ensureSchema(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS sentinel_admin (
    id text PRIMARY KEY, name text NOT NULL DEFAULT 'Admin', email text UNIQUE NOT NULL,
    password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
  // One-time migration: an earlier build created sentinel_client with a
  // different (org-overlay) shape that lacks the `id` column. If we detect
  // that legacy shape, drop it so the correct table is (re)created below.
  // Safe — that legacy table held only bootstrap rows, never real clients.
  const hasId = (await sql`SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sentinel_client' AND column_name = 'id' LIMIT 1`) as unknown[];
  const tableExists = (await sql`SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sentinel_client' LIMIT 1`) as unknown[];
  if (tableExists.length > 0 && hasId.length === 0) {
    await sql`DROP TABLE sentinel_client`;
  }
  await sql`CREATE TABLE IF NOT EXISTS sentinel_client (
    id text PRIMARY KEY, company text NOT NULL, email text UNIQUE NOT NULL,
    password text NOT NULL DEFAULT '', password_hash text NOT NULL,
    status text NOT NULL DEFAULT 'active', plan text NOT NULL DEFAULT 'Growth',
    mrr_cents integer NOT NULL DEFAULT 0, contact text,
    created_at timestamptz NOT NULL DEFAULT now())`;
  // Reversible-encrypted password (replaces the plaintext `password` column).
  await sql`ALTER TABLE sentinel_client ADD COLUMN IF NOT EXISTS password_enc text`;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_audit (
    id text PRIMARY KEY, admin_name text NOT NULL DEFAULT 'System', action text NOT NULL,
    type text NOT NULL DEFAULT 'system', target text, summary text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_agent (
    id text PRIMARY KEY, client_id text NOT NULL, name text NOT NULL,
    role text NOT NULL DEFAULT 'Voice Agent', status text NOT NULL DEFAULT 'live',
    channels text NOT NULL DEFAULT 'Voice Call', gradient text NOT NULL DEFAULT 'from-violet-400 to-fuchsia-500',
    initial text NOT NULL DEFAULT 'A', created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'voice'`;
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS description text`;
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS twilio_subaccount_sid text`;
  // Per-agent knowledge base (one markdown/text document per agent), shared
  // by the admin agent-config page and the client portal knowledge page.
  await sql`CREATE TABLE IF NOT EXISTS sentinel_kb (
    agent_id text PRIMARY KEY, client_id text NOT NULL,
    content text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now())`;
}

// Migrate any legacy plaintext passwords into the encrypted column, then blank
// the plaintext so it no longer lives in the database.
async function migratePlaintextPasswords(sql: Sql) {
  const rows = (await sql`SELECT id, password FROM sentinel_client
    WHERE password_enc IS NULL AND password <> ''`) as { id: string; password: string }[];
  for (const r of rows) {
    await sql`UPDATE sentinel_client SET password_enc = ${encryptSecret(r.password)}, password = '' WHERE id = ${r.id}`;
  }
}

export async function ensureSeed(sql: Sql) {
  if (ensured) return;
  await ensureSchema(sql);
  // Seed the bootstrap admin from env (or sensible defaults).
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@taskforceai.tech").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "sentinel2026";
  await sql`INSERT INTO sentinel_admin (id, name, email, password_hash)
            VALUES (${"adm_" + crypto.randomBytes(6).toString("hex")}, ${"TaskforceAI Admin"}, ${adminEmail}, ${hashPassword(adminPassword)})
            ON CONFLICT (email) DO NOTHING`;
  // Seed a starter client so the dashboard isn't empty and the client portal
  // has a working login out of the box.
  const seedClients = [
    { company: "Tree House Chalets", email: "hello@treehousechalets.com", password: "treehouse2026", plan: "Growth", mrr: 199000, status: "active" },
  ];
  for (const c of seedClients) {
    await sql`INSERT INTO sentinel_client (id, company, email, password, password_enc, password_hash, status, plan, mrr_cents, contact)
              VALUES (${"cli_" + crypto.randomBytes(6).toString("hex")}, ${c.company}, ${c.email.toLowerCase()}, ${""}, ${encryptSecret(c.password)}, ${hashPassword(c.password)}, ${c.status}, ${c.plan}, ${c.mrr}, ${"—"})
              ON CONFLICT (email) DO NOTHING`;
  }
  await migratePlaintextPasswords(sql);
  // Give the starter Tree House client one agent (id "kavya" matches the
  // portal's existing detail pages) so its experience is unchanged.
  const th = (await sql`SELECT id FROM sentinel_client WHERE email = ${"hello@treehousechalets.com"} LIMIT 1`) as { id: string }[];
  if (th[0]) {
    await sql`INSERT INTO sentinel_agent (id, client_id, name, role, status, channels, gradient, initial)
              VALUES (${"kavya"}, ${th[0].id}, ${"Kavya"}, ${"Booking Agent"}, ${"live"}, ${"Voice Call,WhatsApp"}, ${"from-violet-400 to-fuchsia-500"}, ${"K"})
              ON CONFLICT (id) DO NOTHING`;
    // Tree House agent maps to the Tree House Twilio subaccount.
    if (process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID) {
      await sql`UPDATE sentinel_agent SET twilio_subaccount_sid = ${process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID}
                WHERE id = ${"kavya"} AND (twilio_subaccount_sid IS NULL OR twilio_subaccount_sid = '')`;
    }
  }
  ensured = true;
}

export async function findAdminByEmail(email: string): Promise<DbAdmin | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_admin WHERE email = ${email.toLowerCase()} LIMIT 1`) as DbAdmin[];
  return rows[0] ?? null;
}

export async function findClientByEmail(email: string): Promise<DbClient | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_client WHERE email = ${email.toLowerCase()} LIMIT 1`) as DbClient[];
  return rows[0] ?? null;
}

export async function findClientById(id: string): Promise<DbClient | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_client WHERE id = ${id} LIMIT 1`) as DbClient[];
  return rows[0] ?? null;
}

export type DbAgent = {
  id: string;
  client_id: string;
  name: string;
  role: string;
  status: string;
  channels: string;
  gradient: string;
  initial: string;
  type: string; // 'voice' | 'whatsapp' | 'both'
  description: string | null;
  twilio_subaccount_sid: string | null;
  created_at: string;
};

const AGENT_GRADIENTS = [
  "from-violet-400 to-fuchsia-500",
  "from-accent-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
];

export function channelsForType(type: string): string {
  if (type === "whatsapp") return "WhatsApp";
  if (type === "both") return "Voice Call,WhatsApp";
  return "Voice Call";
}

export async function findAgentById(agentId: string): Promise<DbAgent | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_agent WHERE id = ${agentId} LIMIT 1`) as DbAgent[];
  return rows[0] ?? null;
}

export async function listAgentsByClient(clientId: string): Promise<DbAgent[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSeed(sql);
  return (await sql`SELECT * FROM sentinel_agent WHERE client_id = ${clientId} ORDER BY created_at ASC`) as DbAgent[];
}

export async function findAgentForClient(agentId: string, clientId: string): Promise<DbAgent | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_agent WHERE id = ${agentId} AND client_id = ${clientId} LIMIT 1`) as DbAgent[];
  return rows[0] ?? null;
}

export async function createAgent(input: {
  clientId: string;
  name: string;
  role?: string;
  type?: string;
  description?: string;
  channels?: string;
  twilioSubaccountSid?: string;
}): Promise<DbAgent> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const id = "agt_" + crypto.randomBytes(8).toString("hex");
  const initial = (input.name.trim()[0] || "A").toUpperCase();
  const type = ["voice", "whatsapp", "both"].includes(input.type || "") ? input.type! : "voice";
  const channels = input.channels || channelsForType(type);
  const count = (await sql`SELECT count(*)::int AS n FROM sentinel_agent WHERE client_id = ${input.clientId}`) as { n: number }[];
  const gradient = AGENT_GRADIENTS[(count[0]?.n ?? 0) % AGENT_GRADIENTS.length];
  const rows = (await sql`
    INSERT INTO sentinel_agent (id, client_id, name, role, status, channels, gradient, initial, type, description, twilio_subaccount_sid)
    VALUES (${id}, ${input.clientId}, ${input.name}, ${input.role || "Voice Agent"}, ${"live"},
            ${channels}, ${gradient}, ${initial}, ${type}, ${input.description ?? null}, ${input.twilioSubaccountSid?.trim() || null})
    RETURNING *`) as DbAgent[];
  await sql`INSERT INTO sentinel_kb (agent_id, client_id, content) VALUES (${id}, ${input.clientId}, ${""}) ON CONFLICT (agent_id) DO NOTHING`;
  await audit(sql, "agent.create", "agent", input.name, "Created agent " + input.name);
  return rows[0];
}

export async function updateAgent(agentId: string, fields: {
  name?: string;
  role?: string;
  status?: string;
  type?: string;
  description?: string;
  twilioSubaccountSid?: string;
}): Promise<DbAgent | null> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const current = await findAgentById(agentId);
  if (!current) return null;
  const name = fields.name?.trim() || current.name;
  const role = fields.role?.trim() || current.role;
  const status = fields.status || current.status;
  const type = ["voice", "whatsapp", "both"].includes(fields.type || "") ? fields.type! : current.type;
  const channels = channelsForType(type);
  const description = fields.description !== undefined ? fields.description : current.description;
  const twilioSub = fields.twilioSubaccountSid !== undefined ? (fields.twilioSubaccountSid.trim() || null) : current.twilio_subaccount_sid;
  const initial = (name[0] || "A").toUpperCase();
  const rows = (await sql`
    UPDATE sentinel_agent
    SET name = ${name}, role = ${role}, status = ${status}, type = ${type}, channels = ${channels}, description = ${description}, initial = ${initial}, twilio_subaccount_sid = ${twilioSub}
    WHERE id = ${agentId} RETURNING *`) as DbAgent[];
  await audit(sql, "agent.update", "agent", name, "Updated agent " + name);
  return rows[0] ?? null;
}

export async function deleteAgent(agentId: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const current = await findAgentById(agentId);
  if (!current) return false;
  await sql`DELETE FROM sentinel_kb WHERE agent_id = ${agentId}`;
  await sql`DELETE FROM sentinel_agent WHERE id = ${agentId}`;
  await audit(sql, "agent.delete", "agent", current.name, "Deleted agent " + current.name);
  return true;
}

export type DbSnapshot = {
  clients: { id: string; company: string; email: string; plan: string; status: string; mrr_cents: number; created_at: string }[];
  agents: { id: string; client_id: string; name: string; type: string; status: string; channels: string; created_at: string }[];
  admins: { id: string; name: string; email: string; created_at: string }[];
  audit: { admin_name: string; action: string; type: string; target: string | null; summary: string; occurred_at: string }[];
};

// Read-only snapshot for the admin "Database records" page. Never includes
// password hashes or encrypted secrets.
export async function getDbSnapshot(): Promise<DbSnapshot> {
  const sql = getSql();
  if (!sql) return { clients: [], agents: [], admins: [], audit: [] };
  await ensureSeed(sql);
  const [clients, agents, admins, audit] = await Promise.all([
    sql`SELECT id, company, email, plan, status, mrr_cents, created_at FROM sentinel_client ORDER BY created_at DESC`,
    sql`SELECT id, client_id, name, type, status, channels, created_at FROM sentinel_agent ORDER BY created_at DESC`,
    sql`SELECT id, name, email, created_at FROM sentinel_admin ORDER BY created_at ASC`,
    sql`SELECT admin_name, action, type, target, summary, occurred_at FROM sentinel_audit ORDER BY occurred_at DESC LIMIT 100`,
  ]);
  return { clients, agents, admins, audit } as DbSnapshot;
}

export async function getAgentKb(agentId: string): Promise<string> {
  const sql = getSql();
  if (!sql) return "";
  await ensureSeed(sql);
  const rows = (await sql`SELECT content FROM sentinel_kb WHERE agent_id = ${agentId} LIMIT 1`) as { content: string }[];
  return rows[0]?.content ?? "";
}

export async function setAgentKb(agentId: string, clientId: string, content: string): Promise<void> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  await sql`INSERT INTO sentinel_kb (agent_id, client_id, content, updated_at)
            VALUES (${agentId}, ${clientId}, ${content}, now())
            ON CONFLICT (agent_id) DO UPDATE SET content = ${content}, updated_at = now()`;
}

export async function listClients(): Promise<DbClient[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSeed(sql);
  return (await sql`SELECT * FROM sentinel_client ORDER BY created_at DESC`) as DbClient[];
}

const PLAN_FEES: Record<string, number> = { Starter: 97600, Growth: 199000, Scale: 148000, Trial: 0 };

export async function createClient(input: {
  company: string;
  email: string;
  password: string;
  plan?: string;
  status?: string;
  contact?: string;
  mrrCents?: number;
}): Promise<DbClient> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const plan = input.plan || "Growth";
  const mrrCents = typeof input.mrrCents === "number" && input.mrrCents >= 0 ? Math.round(input.mrrCents) : (PLAN_FEES[plan] ?? 0);
  const id = "cli_" + crypto.randomBytes(8).toString("hex");
  const rows = (await sql`
    INSERT INTO sentinel_client (id, company, email, password, password_enc, password_hash, status, plan, mrr_cents, contact)
    VALUES (${id}, ${input.company}, ${input.email.toLowerCase()}, ${""}, ${encryptSecret(input.password)}, ${hashPassword(input.password)},
            ${input.status || "active"}, ${plan}, ${mrrCents}, ${input.contact ?? "—"})
    RETURNING *`) as DbClient[];
  await audit(sql, "client.create", "client", input.company, "Created client " + input.company);
  return rows[0];
}

async function audit(sql: Sql, action: string, type: string, target: string, summary: string) {
  await sql`INSERT INTO sentinel_audit (id, admin_name, action, type, target, summary)
            VALUES (${"aud_" + crypto.randomBytes(6).toString("hex")}, ${"Admin"}, ${action}, ${type}, ${target}, ${summary})`;
}

const ALLOWED_STATUS = new Set(["active", "trial", "suspended", "blocked", "churned"]);

export async function updateClient(id: string, fields: {
  company?: string;
  contact?: string;
  email?: string;
  plan?: string;
  status?: string;
  mrrCents?: number;
}): Promise<DbClient | null> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const current = await findClientById(id);
  if (!current) return null;
  const company = fields.company?.trim() || current.company;
  const contact = fields.contact !== undefined ? fields.contact : current.contact;
  const email = fields.email?.trim().toLowerCase() || current.email;
  const plan = fields.plan || current.plan;
  const status = fields.status && ALLOWED_STATUS.has(fields.status) ? fields.status : current.status;
  const mrr = typeof fields.mrrCents === "number" && fields.mrrCents >= 0 ? Math.round(fields.mrrCents) : current.mrr_cents;
  const rows = (await sql`
    UPDATE sentinel_client
    SET company = ${company}, contact = ${contact}, email = ${email}, plan = ${plan}, status = ${status}, mrr_cents = ${mrr}
    WHERE id = ${id} RETURNING *`) as DbClient[];
  await audit(sql, "client.update", "client", company, "Updated client " + company);
  return rows[0] ?? null;
}

export async function setClientPassword(id: string, newPassword: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const rows = (await sql`
    UPDATE sentinel_client SET password_enc = ${encryptSecret(newPassword)}, password_hash = ${hashPassword(newPassword)}, password = ''
    WHERE id = ${id} RETURNING id`) as { id: string }[];
  if (rows[0]) await audit(sql, "client.password_reset", "client", id, "Reset portal password");
  return !!rows[0];
}

export async function revealClientPassword(id: string): Promise<string | null> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const rows = (await sql`SELECT password_enc, password FROM sentinel_client WHERE id = ${id} LIMIT 1`) as { password_enc: string | null; password: string }[];
  if (!rows[0]) return null;
  return decryptSecret(rows[0].password_enc) ?? (rows[0].password || null);
}

export async function deleteClient(id: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const current = await findClientById(id);
  if (!current) return false;
  await sql`DELETE FROM sentinel_kb WHERE client_id = ${id}`;
  await sql`DELETE FROM sentinel_agent WHERE client_id = ${id}`;
  await sql`DELETE FROM sentinel_client WHERE id = ${id}`;
  await audit(sql, "client.delete", "client", current.company, "Deleted client " + current.company);
  return true;
}
