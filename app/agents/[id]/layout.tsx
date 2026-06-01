import { redirect } from "next/navigation";
import AgentSidebar from "@/components/AgentSidebar";
import AgentTopbar from "@/components/AgentTopbar";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import { getUsageForSubaccount } from "@/lib/twilio";

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
  const dbAgent = await findAgentForClient(params.id, session.clientId);
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

  const sub = dbAgent.twilio_subaccount_sid || process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID || "";
  const usage = await getUsageForSubaccount(sub);

  return (
    <div className="flex min-h-screen">
      <AgentSidebar agent={agent} minutesUsed={Math.round(usage.totalMinutes)} />
      <div className="flex-1 flex flex-col min-w-0">
        <AgentTopbar />
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
