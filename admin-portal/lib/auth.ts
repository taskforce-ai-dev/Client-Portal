import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { ensureSeed, getDB } from "./store";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "dev-insecure-secret-change-me";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createSessionToken(adminId: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${adminId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): { adminId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminId, exp, sig] = parts;
  const payload = `${adminId}.${exp}`;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Date.now() > Number(exp)) return null;
  return { adminId };
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;

export async function verifyAdminLogin(
  email: string,
  password: string
): Promise<{ id: string; email: string } | null> {
  await ensureSeed();
  const db = await getDB();
  const admin = db.admins.find((a) => a.email === email.toLowerCase());
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return null;
  return { id: admin.id, email: admin.email };
}

export type AdminSession = { id: string; email: string };

export async function getSession(): Promise<AdminSession | null> {
  const token = cookies().get(COOKIE)?.value;
  const verified = verifyToken(token);
  if (!verified) return null;
  const db = await getDB();
  const admin = db.admins.find((a) => a.id === verified.adminId);
  return admin ? { id: admin.id, email: admin.email } : null;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
