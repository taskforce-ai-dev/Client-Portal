import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AgentSidebar from "@/components/AgentSidebar";
import AgentTopbar from "@/components/AgentTopbar";
import QuotaBanner from "@/components/QuotaBanner";
import QuotaPopup from "@/components/QuotaPopup";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, listAgentsByClient } from "@/lib/adminDb";
import { getAgentMonthlyQuota, recordQuotaNoticeIfNeeded } from "@/lib/billing";
import { countCurrentMonthNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const [dbAgent, dbAgents] = await Promise.all([
    findAgentForClient(params.id, session.clientId),
    listAgentsByClient(session.clientId),
  ]);
  if (!dbAgent) redirect("/select");

  const agent = {
    id: dbAgent.id,
    name: dbAgent.name,
    role: dbAgent.role,
    status: dbAgent.status as "live" | "paused" | "draft",
    channels: dbAgent.channels.split(",").map((c) => c.trim()).filter(Boolean) as ("Voice Call" | "WhatsApp" | "SMS")[],
    gradient: dbAgent.gradient,
    initial: dbAgent.initial,
  };

  const topbarAgents = dbAgents.map((a) => ({
    id: a.id, name: a.name, role: a.role, gradient: a.gradient, initial: a.initial,
  }));
  const topbarCurrent = { id: agent.id, name: agent.name, role: agent.role, gradient: agent.gradient, initial: agent.initial };

  const quota = await getAgentMonthlyQuota(dbAgent);
  // Fire-once-per-month audit row so the admin Activity Feed surfaces it too.
  await recordQuotaNoticeIfNeeded(dbAgent, quota);
  // Sidebar Bell badge respects the "last-read at" cookie set when the
  // client opens the Notifications tab — visiting the tab clears the
  // unread dot just like a normal inbox.
  const lastReadCookie = cookies().get(`notif_read_${dbAgent.id}`)?.value || null;
  const unread = await countCurrentMonthNotifications(dbAgent.id, lastReadCookie);

  return (
    <div className="flex min-h-screen">
      <AgentSidebar
        agent={agent}
        minutesUsed={quota.billableMinutes}
        minutesLimit={quota.includedMinutes}
        quotaStatus={quota.status}
        unreadNotifications={unread}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AgentTopbar current={topbarCurrent} agents={topbarAgents} unreadNotifications={unread} />
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden space-y-6">
          <QuotaBanner quota={quota} agentId={dbAgent.id} />
          <QuotaPopup agentId={dbAgent.id} agentName={dbAgent.name} quota={quota} />
          {children}
        </main>
      </div>
    </div>
  );
}
