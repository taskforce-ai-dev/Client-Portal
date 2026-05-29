import { redirect } from "next/navigation";
import KnowledgeEditor from "@/components/KnowledgeEditor";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Knowledge Base</h1>
        <p className="text-sm text-slate-400 mt-1">
          Edit what {agent.name} knows. Changes are committed straight to the agent&apos;s
          source so they take effect on the next re-index. Import a PDF to append it.
        </p>
      </div>

      <KnowledgeEditor />
    </div>
  );
}
