"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Building2 } from "lucide-react";

export default function BusinessDetails({ initialCompany }: { initialCompany: string }) {
  const router = useRouter();
  const [company, setCompany] = useState(initialCompany);
  const [saved, setSaved] = useState(initialCompany);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const name = company.trim();
    if (!name) return setMsg({ kind: "err", text: "Business name is required." });
    setBusy(true);
    try {
      const res = await fetch("/api/client/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't save the business name");
      setSaved(d.company);
      setCompany(d.company);
      setMsg({ kind: "ok", text: "Business name saved." });
      router.refresh(); // re-render the server layout so the header/company name updates

    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't save the business name" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-4 space-y-4">
      <div className="text-sm font-medium text-white flex items-center gap-2">
        <Building2 className="w-4 h-4 text-accent-300" /> Business name
      </div>
      {msg && (
        <div
          className={`text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 ring-1 ${
            msg.kind === "ok"
              ? "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20"
              : "text-rose-300 bg-rose-500/10 ring-rose-500/20"
          }`}
        >
          {msg.kind === "ok" && <Check className="w-3.5 h-3.5" />} {msg.text}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="block flex-1">
          <div className="text-xs text-slate-400 mb-1.5">Company / business name</div>
          <input className="input-dark" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your business name" maxLength={120} />
        </label>
        <button type="submit" disabled={busy || company.trim() === saved.trim() || !company.trim()} className="btn-primary disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
        </button>
      </div>
      <p className="text-xs text-slate-500">Shown across your portal (header, agent picker) for everyone on your team.</p>
    </form>
  );
}
