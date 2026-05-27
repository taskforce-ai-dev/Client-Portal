import { messages } from "@/lib/data";

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-slate-500 mt-1">
            {messages.filter((m) => m.unread).length} unread
          </p>
        </div>
        <button className="btn-primary">+ New message</button>
      </div>

      <div className="card divide-y divide-slate-100">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 grid place-items-center text-xs font-semibold shrink-0">
              {m.from.split(" ").map((s) => s[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium">{m.from}</div>
                {m.unread && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </div>
              <div className="text-sm font-medium mt-0.5 truncate">{m.subject}</div>
              <div className="text-sm text-slate-500 mt-0.5 truncate">{m.preview}</div>
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">{m.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
