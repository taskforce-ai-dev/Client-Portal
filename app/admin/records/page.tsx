import Link from "next/link";
import { isAuthed } from "@/lib/adminAuth";
import { getDbSnapshot, isDbConfigured } from "@/lib/adminDb";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return "$" + Math.round((cents || 0) / 100).toLocaleString();
}
function date(d: string) {
  return d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—";
}

export default async function DbRecordsPage() {
  if (!isAuthed()) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">
          You need to be signed in as an admin.{" "}
          <Link href="/admin/login" className="text-cyan-400 underline">Sign in</Link>
        </p>
      </Shell>
    );
  }
  if (!isDbConfigured()) {
    return (
      <Shell>
        <p className="text-sm text-rose-300">DATABASE_URL is not set on this deployment.</p>
      </Shell>
    );
  }

  const { clients, agents, admins, audit } = await getDbSnapshot();

  return (
    <Shell>
      <Section title={`Clients · sentinel_client (${clients.length})`}>
        <Table head={["ID", "Company", "Email", "Plan", "Status", "MRR", "Created"]}>
          {clients.map((c) => (
            <tr key={c.id} className="border-t border-white/5">
              <Td mono>{c.id}</Td><Td>{c.company}</Td><Td>{c.email}</Td><Td>{c.plan}</Td>
              <Td>{c.status}</Td><Td>{money(c.mrr_cents)}</Td><Td mono>{date(c.created_at)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title={`Agents · sentinel_agent (${agents.length})`}>
        <Table head={["ID", "Client ID", "Name", "Type", "Channels", "Status", "Created"]}>
          {agents.map((a) => (
            <tr key={a.id} className="border-t border-white/5">
              <Td mono>{a.id}</Td><Td mono>{a.client_id}</Td><Td>{a.name}</Td><Td>{a.type}</Td>
              <Td>{a.channels}</Td><Td>{a.status}</Td><Td mono>{date(a.created_at)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title={`Admins · sentinel_admin (${admins.length})`}>
        <Table head={["ID", "Name", "Email", "Created"]}>
          {admins.map((a) => (
            <tr key={a.id} className="border-t border-white/5">
              <Td mono>{a.id}</Td><Td>{a.name}</Td><Td>{a.email}</Td><Td mono>{date(a.created_at)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title={`Audit log · sentinel_audit (${audit.length})`}>
        <Table head={["When", "Admin", "Action", "Target", "Summary"]}>
          {audit.map((a, i) => (
            <tr key={i} className="border-t border-white/5">
              <Td mono>{date(a.occurred_at)}</Td><Td>{a.admin_name}</Td><Td mono>{a.action}</Td>
              <Td>{a.target ?? "—"}</Td><Td>{a.summary}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#05070d", color: "#e7ecf5", padding: "28px 22px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Database records</h1>
            <p style={{ fontSize: 12.5, color: "#8a93ab", marginTop: 4 }}>Live read-only view of the Neon tables. No passwords or secrets are shown.</p>
          </div>
          <Link href="/admin" style={{ fontSize: 13, color: "#22d3ee" }}>← Back to admin</Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cdd5e6", marginBottom: 8 }}>{title}</div>
      <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
      <thead>
        <tr style={{ background: "rgba(255,255,255,.03)" }}>
          {head.map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "9px 12px", color: "#8a93ab", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td style={{ padding: "9px 12px", fontFamily: mono ? "ui-monospace, monospace" : "inherit", whiteSpace: "nowrap" }}>{children}</td>
  );
}
