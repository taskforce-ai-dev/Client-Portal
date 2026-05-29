import Link from "next/link";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, findClientById, isDbConfigured } from "@/lib/adminDb";
import { callStats, callsToday, getCalls, getUsageThisMonth } from "@/lib/twilio";
import AgentConfigView from "@/components/AgentConfigView";

export const dynamic = "force-dynamic";

export default async function AdminAgentConfigPage({ params }: { params: { id: string } }) {
  if (!isAuthed()) {
    return (
      <Center>
        You need to be signed in as an admin.{" "}
        <Link href="/admin/login" className="text-cyan-400 underline">Sign in</Link>
      </Center>
    );
  }
  if (!isDbConfigured()) return <Center>DATABASE_URL is not set on this deployment.</Center>;

  const agent = await findAgentById(params.id);
  if (!agent) {
    return (
      <Center>
        Agent not found. <Link href="/admin" className="text-cyan-400 underline">Back to admin</Link>
      </Center>
    );
  }
  const client = await findClientById(agent.client_id);

  const [{ calls, configured }, usage] = await Promise.all([getCalls(200), getUsageThisMonth()]);
  const today = callsToday(calls);
  const stats = callStats(today);

  return (
    <AgentConfigView
      agent={{
        id: agent.id,
        name: agent.name,
        role: agent.role,
        type: agent.type,
        status: agent.status,
        description: agent.description,
        channels: agent.channels,
      }}
      clientCompany={client?.company || "—"}
      clientId={agent.client_id}
      analytics={{
        configured,
        callsToday: today.length,
        convRate: stats.convRate,
        booked: stats.booked,
        avgDuration: stats.avgDuration,
        minutesUsed: Math.round(usage.totalMinutes),
      }}
    />
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#05070d", color: "#e7ecf5", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}
