"use client";

import { useState } from "react";
import { Loader2, Check, User, Mail, Building2, ShieldCheck, Clock, KeyRound } from "lucide-react";

type Profile = {
  email: string;
  name: string | null;
  role: string;
  company: string | null;
  memberSince: string;
  lastLogin: string | null;
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function ProfileManager({ initial }: { initial: Profile }) {
  const [name, setName] = useState(initial.name ?? "");
  const [savedName, setSavedName] = useState(initial.name ?? "");
  const [nameBusy, setNameBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setNameBusy(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't save your name");
      setSavedName(name.trim());
      setMsg({ kind: "ok", text: "Profile updated." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't save your name" });
    } finally {
      setNameBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 8) return setMsg({ kind: "err", text: "New password must be at least 8 characters." });
    if (newPassword !== confirm) return setMsg({ kind: "err", text: "New passwords don't match." });
    setPwBusy(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't change your password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setMsg({ kind: "ok", text: "Password changed." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't change your password" });
    } finally {
      setPwBusy(false);
    }
  }

  const initials =
    (savedName || initial.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";

  return (
    <div className="space-y-6">
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

      {/* Identity summary */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 font-bold grid place-items-center text-lg">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white truncate">{savedName || initial.email}</div>
            <div className="text-sm text-slate-400 truncate">{initial.email}</div>
          </div>
          <span className="ml-auto pill-emerald inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> {initial.role}
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <Info icon={Building2} label="Company" value={initial.company ?? "—"} />
          <Info icon={Clock} label="Member since" value={fmtDate(initial.memberSince)} />
          <Info icon={Clock} label="Last sign-in" value={fmtDate(initial.lastLogin)} />
        </div>
      </div>

      {/* Display name */}
      <form onSubmit={saveName} className="card p-5 space-y-4">
        <div className="text-sm font-medium text-white flex items-center gap-2">
          <User className="w-4 h-4 text-accent-300" /> Display name
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="block flex-1">
            <div className="text-xs text-slate-400 mb-1.5">Name</div>
            <input className="input-dark" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>
          <button type="submit" disabled={nameBusy || name.trim() === savedName.trim()} className="btn-primary disabled:opacity-60">
            {nameBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
          </button>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" /> Your email ({initial.email}) is your sign-in and can't be changed here.
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <div className="text-sm font-medium text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent-300" /> Change password
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2 max-w-sm">
            <div className="text-xs text-slate-400 mb-1.5">Current password</div>
            <input className="input-dark" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="block">
            <div className="text-xs text-slate-400 mb-1.5">New password</div>
            <input className="input-dark" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
          </label>
          <label className="block">
            <div className="text-xs text-slate-400 mb-1.5">Confirm new password</div>
            <input className="input-dark" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <button type="submit" disabled={pwBusy || !currentPassword || !newPassword} className="btn-primary disabled:opacity-60">
          {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Update password
        </button>
      </form>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 px-3 py-2.5">
      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-sm text-slate-200 truncate">{value}</div>
    </div>
  );
}
