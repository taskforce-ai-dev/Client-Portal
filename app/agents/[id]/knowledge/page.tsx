import { FileText, Globe, HelpCircle, MoreHorizontal, Upload } from "lucide-react";
import { docs } from "@/lib/data";

const typeIcon = {
  PDF: FileText,
  Doc: FileText,
  URL: Globe,
  FAQ: HelpCircle,
} as const;

const typeColor: Record<string, string> = {
  PDF: "from-rose-400 to-pink-500",
  Doc: "from-accent-400 to-indigo-500",
  URL: "from-emerald-400 to-teal-500",
  FAQ: "from-amber-400 to-orange-500",
};

const statusPill: Record<string, string> = {
  indexed: "pill-emerald",
  indexing: "pill-amber",
  failed: "pill-rose",
};

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Knowledge Base</h1>
          <p className="text-sm text-slate-400 mt-1">
            {docs.length} sources · {docs.filter((d) => d.status === "indexed").length} indexed
          </p>
        </div>
        <button className="btn-primary">
          <Upload className="w-4 h-4" /> Upload source
        </button>
      </div>

      <div className="card p-5 bg-gradient-to-br from-accent-500/[0.08] to-transparent border border-accent-500/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-500/15 text-accent-300 grid place-items-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-white">Kavya answers from these sources</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Upload PDFs, link URLs, or paste FAQs. Sources are re-indexed automatically when changed.
            </div>
          </div>
          <button className="btn-ghost text-xs">Test a question</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {docs.map((d) => {
          const Icon = typeIcon[d.type] ?? FileText;
          return (
            <div key={d.id} className="card p-5 hover:ring-1 hover:ring-accent-500/20 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeColor[d.type]} text-ink-950 grid place-items-center shrink-0`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{d.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {d.type} · {d.size}
                    </div>
                  </div>
                </div>
                <button className="text-slate-500 hover:text-slate-300">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className={statusPill[d.status]}>{d.status}</span>
                <span className="text-xs text-slate-500">Updated {d.updated}</span>
              </div>
            </div>
          );
        })}

        <button className="card p-5 border-dashed border border-white/10 bg-transparent ring-0 hover:bg-white/[0.02] transition grid place-items-center text-center min-h-[150px]">
          <div>
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] ring-1 ring-white/10 grid place-items-center mx-auto mb-2">
              <Upload className="w-4 h-4 text-accent-300" />
            </div>
            <div className="font-medium text-slate-200 text-sm">Add a source</div>
            <div className="text-xs text-slate-500 mt-0.5">PDF · URL · Doc · FAQ</div>
          </div>
        </button>
      </div>
    </div>
  );
}
