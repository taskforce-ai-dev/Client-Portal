import { notFound } from "next/navigation";
import AgentSidebar from "@/components/AgentSidebar";
import AgentTopbar from "@/components/AgentTopbar";
import { agents } from "@/lib/data";
import { getUsageThisMonth } from "@/lib/twilio";

export const revalidate = 60;

export function generateStaticParams() {
  return agents.map((a) => ({ id: a.id }));
}

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const agent = agents.find((a) => a.id === params.id);
  if (!agent) notFound();

  const usage = await getUsageThisMonth();

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
