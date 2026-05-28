import ClientsManager from "@/components/ClientsManager";
import { listClients } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();
  return <ClientsManager initialClients={clients} />;
}
