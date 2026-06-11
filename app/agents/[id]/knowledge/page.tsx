import { redirect } from "next/navigation";
import KnowledgeEditor from "@/components/KnowledgeEditor";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import { guardClientFeature } from "@/lib/featureAccess";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");
  await guardClientFeature("knowledge", params.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Knowledge Base</h1>
        <p className="text-sm text-slate-400 mt-1">
          View what {agent.name} knows. Contact your admin to request changes.
        </p>
      </div>

      <KnowledgeEditor endpoint={`/api/agents/${agent.id}/kb`} allowUpload={false} readOnly={true} />
    </div>
  );
}
