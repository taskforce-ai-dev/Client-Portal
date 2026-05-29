import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import { hashPassword } from "./passwords";

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
  password: string; // plaintext, shown to admin (internal tool)
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
  await sql`CREATE TABLE IF NOT EXISTS sentinel_audit (
    id text PRIMARY KEY, admin_name text NOT NULL DEFAULT 'System', action text NOT NULL,
    type text NOT NULL DEFAULT 'system', target text, summary text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now())`;
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
    await sql`INSERT INTO sentinel_client (id, company, email, password, password_hash, status, plan, mrr_cents, contact)
              VALUES (${"cli_" + crypto.randomBytes(6).toString("hex")}, ${c.company}, ${c.email.toLowerCase()}, ${c.password}, ${hashPassword(c.password)}, ${c.status}, ${c.plan}, ${c.mrr}, ${"—"})
              ON CONFLICT (email) DO NOTHING`;
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
  const rows = (await sql`SELECT * FROM sentinel_client WHERE id = ${id} LIMIT 1`) as DbClient[];
  return rows[0] ?? null;
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
}): Promise<DbClient> {
  const sql = getSql();
  if (!sql) throw new Error("Database not configured");
  await ensureSeed(sql);
  const plan = input.plan || "Growth";
  const id = "cli_" + crypto.randomBytes(8).toString("hex");
  const rows = (await sql`
    INSERT INTO sentinel_client (id, company, email, password, password_hash, status, plan, mrr_cents, contact)
    VALUES (${id}, ${input.company}, ${input.email.toLowerCase()}, ${input.password}, ${hashPassword(input.password)},
            ${input.status || "active"}, ${plan}, ${PLAN_FEES[plan] ?? 0}, ${input.contact ?? "—"})
    RETURNING *`) as DbClient[];
  await sql`INSERT INTO sentinel_audit (id, admin_name, action, type, target, summary)
            VALUES (${"aud_" + crypto.randomBytes(6).toString("hex")}, ${"Admin"}, ${"client.create"}, ${"client"}, ${input.company}, ${"Created client " + input.company})`;
  return rows[0];
}
