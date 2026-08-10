import Link from "next/link";
import { isAuthed } from "@/lib/adminAuth";
import { isDbConfigured, listClients } from "@/lib/adminDb";
import InviteButton from "./InviteButton";

export const dynamic = "force-dynamic";

function date(d: string) {
  return d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—";
}

// Admin console page for onboarding: create-client already exists elsewhere
// in the admin console; this page is where an admin sends the single-use
// set-password link once a client row exists. Same action re-sends it as
// an admin-triggered password reset.
export default async function AdminClientsPage() {
  if (!isAuthed()) {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>
          You need to be signed in as an admin.{" "}
          <Link href="/admin/login" style={{ color: "#22d3ee" }}>Sign in</Link>
        </p>
      </Shell>
    );
  }
  if (!isDbConfigured()) {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: "#fca5a5" }}>DATABASE_URL is not set on this deployment.</p>
      </Shell>
    );
  }

  const clients = await listClients();

  return (
    <Shell>
      <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,.03)" }}>
              {["Company", "Email", "Status", "Plan", "Created", "Portal access"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "9px 12px", color: "#8a93ab", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                <td style={{ padding: "9px 12px" }}>{c.company}</td>
                <td style={{ padding: "9px 12px" }}>{c.email}</td>
                <td style={{ padding: "9px 12px" }}>{c.status}</td>
                <td style={{ padding: "9px 12px" }}>{c.plan}</td>
                <td style={{ padding: "9px 12px", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" }}>{date(c.created_at)}</td>
                <td style={{ padding: "9px 12px" }}>
                  <InviteButton clientId={c.id} label="Send invite" />
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "14px 12px", color: "#64748b" }}>No clients yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#05070d", color: "#e7ecf5", padding: "28px 22px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Clients</h1>
            <p style={{ fontSize: 12.5, color: "#8a93ab", marginTop: 4 }}>
              Send a client their single-use set-password link. Nobody — including this admin console —
              ever sees the password the client chooses.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/admin/records" style={{ fontSize: 13, color: "#a78bfa" }}>Records →</Link>
            <Link href="/admin" style={{ fontSize: 13, color: "#22d3ee" }}>← Back to admin</Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
