import { notFound } from "next/navigation";
import ClientDetail from "@/components/ClientDetail";
import { getClient, listSalespeople } from "@/lib/store";
import { getClientAgents } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  if (!client) notFound();

  const [agents, salespeople] = await Promise.all([
    getClientAgents(params.id),
    listSalespeople(),
  ]);

  const rows = agents.map((a) => ({
    id: a.id,
    clientId: a.clientId,
    name: a.name,
    role: a.role,
    channel: a.channel,
    status: a.status,
    salespersonId: a.salespersonId,
    commissionPercent: a.commissionPercent,
    createdAt: a.createdAt,
    salesTotal: a.salesTotal,
    commission: a.commission,
  }));

  return <ClientDetail client={client} initialAgents={rows} salespeople={salespeople} />;
}
