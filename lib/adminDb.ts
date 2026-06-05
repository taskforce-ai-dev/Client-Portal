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
  // Ingest API key — your custom backend uses this to POST Anthropic token
  // usage for each Claude call so we can show per-agent token analytics.
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS ingest_key text`;
  // Reversibly-encrypted third-party API keys (Anthropic, ElevenLabs) so the
  // admin can paste them once per agent and reveal them later.
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS anthropic_api_key_enc text`;
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS elevenlabs_api_key_enc text`;
  // KB reload webhook URL — dashboard POSTs new content here after admin saves KB.
  await sql`ALTER TABLE sentinel_agent ADD COLUMN IF NOT EXISTS kb_reload_url text`;
  // Per-agent knowledge base (one markdown/text document per agent), shared
  // by the admin agent-config page and the client portal knowledge page.
  await sql`CREATE TABLE IF NOT EXISTS sentinel_kb (
    agent_id text PRIMARY KEY, client_id text NOT NULL,
    content text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now())`;
  // Token usage records: one row per LLM completion, posted by the agent's
  // backend. cost_usd_micros = USD * 1_000_000 (precise int arithmetic).
  await sql`CREATE TABLE IF NOT EXISTS sentinel_token_usage (
    id text PRIMARY KEY,
    agent_id text NOT NULL,
    client_id text NOT NULL,
    model text NOT NULL DEFAULT '',
    input_tokens integer NOT NULL DEFAULT 0,
    output_tokens integer NOT NULL DEFAULT 0,
    cache_creation_tokens integer NOT NULL DEFAULT 0,
    cache_read_tokens integer NOT NULL DEFAULT 0,
    cost_usd_micros bigint NOT NULL DEFAULT 0,
    twilio_call_sid text,
    occurred_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS sentinel_token_usage_agent_at_idx ON sentinel_token_usage (agent_id, occurred_at DESC)`;
  // One organised summary per call (no full transcript). Optional structured
  // fields so the admin / client portal can render it as a small report.
  await sql`CREATE TABLE IF NOT EXISTS sentinel_call_summary (
    id text PRIMARY KEY,
    agent_id text NOT NULL,
    client_id text NOT NULL,
    twilio_call_sid text UNIQUE,
    caller_name text,
    caller_phone text,
    summary text NOT NULL DEFAULT '',
    key_points text,
    action_items text,
    mentioned_dates text,
    sentiment text,
    topics text,
    duration_sec integer,
    occurred_at timestamptz NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE sentinel_call_summary ADD COLUMN IF NOT EXISTS transcript text`;
  await sql`CREATE INDEX IF NOT EXISTS sentinel_call_summary_agent_at_idx ON sentinel_call_summary (agent_id, occurred_at DESC)`;
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
  // Backfill an ingest API key for any agent missing one.
  const noKey = (await sql`SELECT id FROM sentinel_agent WHERE ingest_key IS NULL OR ingest_key = ''`) as { id: string }[];
  for (const r of noKey) {
    await sql`UPDATE sentinel_agent SET ingest_key = ${"ingest_" + crypto.randomBytes(20).toString("hex")} WHERE id = ${r.id}`;
  }
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

export async function listAdmins(): Promise<DbAdmin[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSeed(sql);
  return (await sql`SELECT id, name, email, password_hash, created_at FROM sentinel_admin ORDER BY created_at ASC`) as DbAdmin[];
}

export async function findAdminById(id: string): Promise<DbAdmin | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_admin WHERE id = ${id} LIMIT 1`) as DbAdmin[];
  return rows[0] ?? null;
}

export async function createAdmin(input: { name?: string; email: string; password: string }): Promise<DbAdmin> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const id = "adm_" + crypto.randomBytes(8).toString("hex");
  const email = input.email.trim().toLowerCase();
  const name = (input.name || email.split("@")[0]).trim();
  const rows = (await sql`
    INSERT INTO sentinel_admin (id, name, email, password_hash)
    VALUES (${id}, ${name}, ${email}, ${hashPassword(input.password)})
    RETURNING *`) as DbAdmin[];
  await audit(sql, "admin.create", "admin", email, "Invited admin " + email);
  return rows[0];
}

export async function setAdminPassword(id: string, newPassword: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const rows = (await sql`UPDATE sentinel_admin SET password_hash = ${hashPassword(newPassword)} WHERE id = ${id} RETURNING email`) as { email: string }[];
  if (rows[0]) await audit(sql, "admin.password_reset", "admin", rows[0].email, "Reset password for " + rows[0].email);
  return !!rows[0];
}

export async function deleteAdmin(id: string): Promise<{ ok: boolean; reason?: string }> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const current = await findAdminById(id);
  if (!current) return { ok: false, reason: "not_found" };
  const count = (await sql`SELECT count(*)::int AS n FROM sentinel_admin`) as { n: number }[];
  if ((count[0]?.n ?? 0) <= 1) return { ok: false, reason: "last_admin" };
  await sql`DELETE FROM sentinel_admin WHERE id = ${id}`;
  await audit(sql, "admin.delete", "admin", current.email, "Revoked admin " + current.email);
  return { ok: true };
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
  ingest_key: string | null;
  anthropic_api_key_enc: string | null;
  elevenlabs_api_key_enc: string | null;
  kb_reload_url: string | null;
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
  const ingestKey = "ingest_" + crypto.randomBytes(20).toString("hex");
  const rows = (await sql`
    INSERT INTO sentinel_agent (id, client_id, name, role, status, channels, gradient, initial, type, description, twilio_subaccount_sid, ingest_key)
    VALUES (${id}, ${input.clientId}, ${input.name}, ${input.role || "Voice Agent"}, ${"live"},
            ${channels}, ${gradient}, ${initial}, ${type}, ${input.description ?? null}, ${input.twilioSubaccountSid?.trim() || null}, ${ingestKey})
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
  anthropicApiKey?: string;
  elevenlabsApiKey?: string;
  kbReloadUrl?: string;
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
  // For API keys: undefined = keep, "" = clear, non-empty = set & encrypt.
  const anthropicEnc = fields.anthropicApiKey === undefined
    ? current.anthropic_api_key_enc
    : (fields.anthropicApiKey.trim() ? encryptSecret(fields.anthropicApiKey.trim()) : null);
  const kbReloadUrl = fields.kbReloadUrl !== undefined ? (fields.kbReloadUrl.trim() || null) : current.kb_reload_url;
  const elevenlabsEnc = fields.elevenlabsApiKey === undefined
    ? current.elevenlabs_api_key_enc
    : (fields.elevenlabsApiKey.trim() ? encryptSecret(fields.elevenlabsApiKey.trim()) : null);
  const initial = (name[0] || "A").toUpperCase();
  const rows = (await sql`
    UPDATE sentinel_agent
    SET name = ${name}, role = ${role}, status = ${status}, type = ${type}, channels = ${channels}, description = ${description}, initial = ${initial}, twilio_subaccount_sid = ${twilioSub}, anthropic_api_key_enc = ${anthropicEnc}, elevenlabs_api_key_enc = ${elevenlabsEnc}, kb_reload_url = ${kbReloadUrl}
    WHERE id = ${agentId} RETURNING *`) as DbAgent[];
  await audit(sql, "agent.update", "agent", name, "Updated agent " + name);
  return rows[0] ?? null;
}

export async function revealAgentApiKeys(agentId: string): Promise<{ anthropic: string | null; elevenlabs: string | null } | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT anthropic_api_key_enc, elevenlabs_api_key_enc FROM sentinel_agent WHERE id = ${agentId} LIMIT 1`) as { anthropic_api_key_enc: string | null; elevenlabs_api_key_enc: string | null }[];
  if (!rows[0]) return null;
  return {
    anthropic: decryptSecret(rows[0].anthropic_api_key_enc),
    elevenlabs: decryptSecret(rows[0].elevenlabs_api_key_enc),
  };
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

export async function regenerateAgentIngestKey(agentId: string): Promise<string | null> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const key = "ingest_" + crypto.randomBytes(20).toString("hex");
  const rows = (await sql`UPDATE sentinel_agent SET ingest_key = ${key} WHERE id = ${agentId} RETURNING name`) as { name: string }[];
  if (!rows[0]) return null;
  await audit(sql, "agent.ingest_key.rotate", "agent", rows[0].name, "Rotated ingest API key for " + rows[0].name);
  return key;
}

export async function findAgentByIngestKey(key: string): Promise<DbAgent | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureSeed(sql);
  const rows = (await sql`SELECT * FROM sentinel_agent WHERE ingest_key = ${key} LIMIT 1`) as DbAgent[];
  return rows[0] ?? null;
}

export type DbTokenUsage = {
  id: string;
  agent_id: string;
  client_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost_usd_micros: number;
  twilio_call_sid: string | null;
  occurred_at: string;
};

export async function recordTokenUsage(input: {
  id: string;
  agentId: string;
  clientId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  costMicros: number;
  twilioCallSid?: string | null;
  occurredAt?: Date | null;
}): Promise<{ inserted: boolean }> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const rows = (await sql`
    INSERT INTO sentinel_token_usage
      (id, agent_id, client_id, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd_micros, twilio_call_sid, occurred_at)
    VALUES (${input.id}, ${input.agentId}, ${input.clientId}, ${input.model},
            ${input.inputTokens | 0}, ${input.outputTokens | 0},
            ${(input.cacheCreationTokens || 0) | 0}, ${(input.cacheReadTokens || 0) | 0},
            ${input.costMicros}, ${input.twilioCallSid ?? null}, ${input.occurredAt ? input.occurredAt.toISOString() : new Date().toISOString()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`) as { id: string }[];
  return { inserted: rows.length > 0 };
}

export async function listTokenUsage(agentId: string, opts: { startIso?: string; endIso?: string; limit?: number } = {}): Promise<DbTokenUsage[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSeed(sql);
  const limit = Math.min(opts.limit ?? 1000, 5000);
  if (opts.startIso && opts.endIso) {
    return (await sql`
      SELECT * FROM sentinel_token_usage
      WHERE agent_id = ${agentId} AND occurred_at >= ${opts.startIso} AND occurred_at < ${opts.endIso}
      ORDER BY occurred_at DESC LIMIT ${limit}`) as DbTokenUsage[];
  }
  return (await sql`
    SELECT * FROM sentinel_token_usage
    WHERE agent_id = ${agentId}
    ORDER BY occurred_at DESC LIMIT ${limit}`) as DbTokenUsage[];
}

export type DbCallSummary = {
  id: string;
  agent_id: string;
  client_id: string;
  twilio_call_sid: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  summary: string;
  key_points: string | null;
  action_items: string | null;
  mentioned_dates: string | null;
  sentiment: string | null;
  topics: string | null;
  duration_sec: number | null;
  transcript: string | null;
  occurred_at: string;
};

export async function recordCallSummary(input: {
  id: string;
  agentId: string;
  clientId: string;
  twilioCallSid?: string | null;
  callerName?: string | null;
  callerPhone?: string | null;
  summary: string;
  keyPoints?: string | null;
  actionItems?: string | null;
  mentionedDates?: string | null;
  sentiment?: string | null;
  topics?: string | null;
  durationSec?: number | null;
  transcript?: string | null;
  occurredAt?: Date | null;
}): Promise<{ inserted: boolean }> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  // ON CONFLICT (id) preserves idempotency from request_id; UNIQUE on
  // twilio_call_sid prevents posting two summaries for the same call.
  try {
    const rows = (await sql`
      INSERT INTO sentinel_call_summary
        (id, agent_id, client_id, twilio_call_sid, caller_name, caller_phone, summary, key_points, action_items, mentioned_dates, sentiment, topics, duration_sec, transcript, occurred_at)
      VALUES (${input.id}, ${input.agentId}, ${input.clientId},
              ${input.twilioCallSid ?? null}, ${input.callerName ?? null}, ${input.callerPhone ?? null},
              ${input.summary}, ${input.keyPoints ?? null}, ${input.actionItems ?? null},
              ${input.mentionedDates ?? null}, ${input.sentiment ?? null}, ${input.topics ?? null},
              ${input.durationSec ?? null}, ${input.transcript ?? null},
              ${input.occurredAt ? input.occurredAt.toISOString() : new Date().toISOString()})
      ON CONFLICT (id) DO NOTHING
      RETURNING id`) as { id: string }[];
    return { inserted: rows.length > 0 };
  } catch (e) {
    // Most likely a unique-violation on twilio_call_sid — treat as duplicate.
    if (e instanceof Error && /unique|duplicate/i.test(e.message)) return { inserted: false };
    throw e;
  }
}

export async function listCallSummaries(agentId: string, opts: { limit?: number; startIso?: string; endIso?: string } = {}): Promise<DbCallSummary[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSeed(sql);
  const limit = Math.min(opts.limit ?? 100, 1000);
  if (opts.startIso && opts.endIso) {
    return (await sql`SELECT * FROM sentinel_call_summary
      WHERE agent_id = ${agentId} AND occurred_at >= ${opts.startIso} AND occurred_at < ${opts.endIso}
      ORDER BY occurred_at DESC LIMIT ${limit}`) as DbCallSummary[];
  }
  return (await sql`SELECT * FROM sentinel_call_summary
    WHERE agent_id = ${agentId}
    ORDER BY occurred_at DESC LIMIT ${limit}`) as DbCallSummary[];
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
