import { Plus } from "lucide-react";
import { messages } from "@/lib/data";

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Messages</h1>
          <p className="text-sm text-slate-400 mt-1">
            {messages.filter((m) => m.unread).length} unread
          </p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New message
        </button>
      </div>

      <div className="card divide-y divide-white/5">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-4 p-4 hover:bg-white/[0.02] cursor-pointer">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 grid place-items-center text-xs font-bold shrink-0">
              {m.from.split(" ").map((s) => s[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-slate-100">{m.from}</div>
                {m.unread && <span className="w-1.5 h-1.5 rounded-full bg-accent-400 shadow-[0_0_8px_0_rgba(34,211,238,0.8)]" />}
              </div>
              <div className="text-sm font-medium text-slate-200 mt-0.5 truncate">{m.subject}</div>
              <div className="text-sm text-slate-500 mt-0.5 truncate">{m.preview}</div>
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">{m.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
