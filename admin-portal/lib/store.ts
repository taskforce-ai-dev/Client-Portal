import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Agent, Client, DB, Sale, Salesperson } from "./types";

// ---------------------------------------------------------------------------
// JSON-file backed store. Small scale, read/write the whole document.
// Structured behind these functions so a Postgres implementation can drop in
// later (see DATABASE_URL in .env.example) without touching callers.
// ---------------------------------------------------------------------------

const DATA_FILE =
  process.env.ADMIN_DATA_FILE || path.join(os.tmpdir(), "admin-portal-db.json");

const EMPTY: DB = {
  admins: [],
  clients: [],
  salespeople: [],
  agents: [],
  sales: [],
};

let writeLock: Promise<void> = Promise.resolve();

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

async function readDB(): Promise<DB> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function writeDB(db: DB): Promise<void> {
  const run = async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  };
  writeLock = writeLock.then(run, run);
  return writeLock;
}

export async function withDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const db = await readDB();
  const result = await fn(db);
  await writeDB(db);
  return result;
}

export async function getDB(): Promise<DB> {
  return readDB();
}

// ---------------------------------------------------------------------------
// Seeding — ensure an admin account exists so the portal is reachable.
// ---------------------------------------------------------------------------
let seeded = false;
export async function ensureSeed(): Promise<void> {
  if (seeded) return;
  await withDB(async (db) => {
    if (db.admins.length === 0) {
      const email = process.env.ADMIN_EMAIL || "admin@taskforceai.tech";
      const password = process.env.ADMIN_PASSWORD || "change-me-now";
      db.admins.push({
        id: id("adm"),
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: new Date().toISOString(),
      });
    }
  });
  seeded = true;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
export async function listClients(): Promise<Client[]> {
  return (await getDB()).clients.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClient(clientId: string): Promise<Client | undefined> {
  return (await getDB()).clients.find((c) => c.id === clientId);
}

export async function createClient(input: {
  name: string;
  company: string;
  email: string;
  password: string;
  status?: Client["status"];
}): Promise<Client> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return withDB((db) => {
    const client: Client = {
      id: id("cli"),
      name: input.name,
      company: input.company,
      email: input.email.toLowerCase(),
      password: input.password,
      passwordHash,
      status: input.status ?? "trial",
      createdAt: new Date().toISOString(),
    };
    db.clients.push(client);
    return client;
  });
}

export async function updateClient(
  clientId: string,
  patch: Partial<Pick<Client, "name" | "company" | "email" | "status">>
): Promise<Client | undefined> {
  return withDB((db) => {
    const c = db.clients.find((x) => x.id === clientId);
    if (!c) return undefined;
    Object.assign(c, patch);
    return c;
  });
}

// ---------------------------------------------------------------------------
// Salespeople
// ---------------------------------------------------------------------------
export async function listSalespeople(): Promise<Salesperson[]> {
  return (await getDB()).salespeople.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSalesperson(spId: string): Promise<Salesperson | undefined> {
  return (await getDB()).salespeople.find((s) => s.id === spId);
}

export async function createSalesperson(input: {
  name: string;
  email: string;
  phone?: string;
}): Promise<Salesperson> {
  return withDB((db) => {
    const sp: Salesperson = {
      id: id("sp"),
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      createdAt: new Date().toISOString(),
    };
    db.salespeople.push(sp);
    return sp;
  });
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
export async function listAgents(clientId?: string): Promise<Agent[]> {
  const agents = (await getDB()).agents;
  return clientId ? agents.filter((a) => a.clientId === clientId) : agents;
}

export async function getAgent(agentId: string): Promise<Agent | undefined> {
  return (await getDB()).agents.find((a) => a.id === agentId);
}

export async function createAgent(input: {
  clientId: string;
  name: string;
  role: string;
  channel: Agent["channel"];
  status?: Agent["status"];
  salespersonId?: string | null;
  commissionPercent?: number;
}): Promise<Agent> {
  return withDB((db) => {
    const agent: Agent = {
      id: id("agt"),
      clientId: input.clientId,
      name: input.name,
      role: input.role,
      channel: input.channel,
      status: input.status ?? "draft",
      salespersonId: input.salespersonId ?? null,
      commissionPercent: input.commissionPercent ?? 0,
      createdAt: new Date().toISOString(),
    };
    db.agents.push(agent);
    return agent;
  });
}

export async function updateAgent(
  agentId: string,
  patch: Partial<Pick<Agent, "name" | "role" | "channel" | "status" | "salespersonId" | "commissionPercent">>
): Promise<Agent | undefined> {
  return withDB((db) => {
    const a = db.agents.find((x) => x.id === agentId);
    if (!a) return undefined;
    Object.assign(a, patch);
    return a;
  });
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------
export async function listSales(agentId?: string): Promise<Sale[]> {
  const sales = (await getDB()).sales;
  return (agentId ? sales.filter((s) => s.agentId === agentId) : sales).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

export async function createSale(input: {
  agentId: string;
  amount: number;
  currency?: string;
  description: string;
  date?: string;
}): Promise<Sale> {
  return withDB((db) => {
    const sale: Sale = {
      id: id("sale"),
      agentId: input.agentId,
      amount: input.amount,
      currency: input.currency ?? "USD",
      description: input.description,
      date: input.date ?? new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    db.sales.push(sale);
    return sale;
  });
}
