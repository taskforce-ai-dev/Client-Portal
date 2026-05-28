import { notFound } from "next/navigation";
import KnowledgeEditor from "@/components/KnowledgeEditor";
import { agents } from "@/lib/data";

export default function KnowledgeBasePage({ params }: { params: { id: string } }) {
  const agent = agents.find((a) => a.id === params.id);
  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Knowledge Base</h1>
        <p className="text-sm text-slate-400 mt-1">
          Edit what {agent.name} knows. Write it as plain text or import a PDF — PDFs are
          converted to markdown and appended below.
        </p>
      </div>

      <KnowledgeEditor agentId={agent.id} />
    </div>
  );
}
