"use client";

import { useState } from "react";
import { Loader2, UserPlus, ShieldCheck, ShieldOff, Ban, RotateCcw, Check } from "lucide-react";

type User = {
  id: string;
  client_id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  allowed_features: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
};

const FEATURE_LABELS: Record<string, string> = {
  callLog: "Call Log",
  knowledge: "Knowledge Base",
  analytics: "Analytics",
  conversions: "Conversions",
  billing: "Billing",
  transcripts: "Transcripts",
  metaInbox: "Meta Inbox",
};

function featureList(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function TeamManager({
  meId,
  companyFeatures,
  initialUsers,
}: {
  meId: string;
  companyFeatures: string[];
  initialUsers: User[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add-user form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [features, setFeatures] = useState<Set<string>>(new Set(companyFeatures));

  // Per-user inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFeatures, setEditFeatures] = useState<Set<string>>(new Set());
  const [editAdmin, setEditAdmin] = useState(false);

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Email is required.");
    if (password && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/client-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          password: password || undefined,
          isAdmin,
          allowedFeatures: isAdmin ? [] : [...features],
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't create the user");
      setUsers((u) => [d.user, ...u]);
      setEmail("");
      setName("");
      setPassword("");
      setIsAdmin(false);
      setFeatures(new Set(companyFeatures));
      setNotice(password ? "User created — they can sign in now." : "User created (invited — they'll set a password via their invite link).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the user");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(id: string, patch: Record<string, unknown>, okMsg: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/client-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Update failed");
      setUsers((list) => list.map((u) => (u.id === id ? d.user : u)));
      setEditingId(null);
      setNotice(okMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "disabled" | "active", okMsg: string) {
    await patchUser(id, { status }, okMsg);
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditFeatures(new Set(featureList(u.allowed_features)));
    setEditAdmin(u.is_admin);
  }

  const featureChoices = companyFeatures.length ? companyFeatures : Object.keys(FEATURE_LABELS);

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 ring-1 ring-rose-500/20 rounded-lg px-3 py-2">{error}</div>
      )}
      {notice && !error && (
        <div className="text-xs text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> {notice}
        </div>
      )}

      {/* Add user */}
      <form onSubmit={addUser} className="card p-4 space-y-4">
        <div className="text-sm font-medium text-white flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-accent-300" /> Add a team member
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input-dark" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          <input className="input-dark" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input-dark" placeholder="Temporary password (min 8, optional)" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            Admin (can manage the team & all features)
          </label>
        </div>
        {!isAdmin && (
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Features this member can access</div>
            <div className="flex flex-wrap gap-2">
              {featureChoices.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFeatures((s) => toggle(s, f))}
                  className={`text-xs px-2.5 py-1 rounded-full ring-1 transition ${
                    features.has(f) ? "bg-accent-500/20 ring-accent-400/40 text-accent-100" : "bg-white/[0.04] ring-white/10 text-slate-400"
                  }`}
                >
                  {FEATURE_LABELS[f] ?? f}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Add member
        </button>
      </form>

      {/* Users */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Access</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 align-top">
                  <td className="px-4 py-3">
                    <div className="text-slate-200">{u.email}</div>
                    {u.name && <div className="text-xs text-slate-500">{u.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_admin ? <span className="pill-emerald">Admin</span> : <span className="text-slate-400 text-xs">Member</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          <input type="checkbox" checked={editAdmin} onChange={(e) => setEditAdmin(e.target.checked)} /> Admin (all features)
                        </label>
                        {!editAdmin && (
                          <div className="flex flex-wrap gap-1.5">
                            {featureChoices.map((f) => (
                              <button
                                type="button"
                                key={f}
                                onClick={() => setEditFeatures((s) => toggle(s, f))}
                                className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${
                                  editFeatures.has(f) ? "bg-accent-500/20 ring-accent-400/40 text-accent-100" : "bg-white/[0.04] ring-white/10 text-slate-400"
                                }`}
                              >
                                {FEATURE_LABELS[f] ?? f}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            className="btn-primary !py-1 !text-xs"
                            disabled={busy}
                            onClick={() => patchUser(u.id, { isAdmin: editAdmin, allowedFeatures: editAdmin ? [] : [...editFeatures] }, "Access updated.")}
                          >
                            Save
                          </button>
                          <button className="btn-ghost !py-1 !text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : u.is_admin ? (
                      <span className="text-xs text-slate-500">All features</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {featureList(u.allowed_features).length === 0 ? (
                          <span className="text-xs text-slate-600">No features</span>
                        ) : (
                          featureList(u.allowed_features).map((f) => (
                            <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] ring-1 ring-white/10 text-slate-300">
                              {FEATURE_LABELS[f] ?? f}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.status === "active" ? "text-emerald-300" : u.status === "disabled" ? "text-rose-300" : "text-amber-300"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {editingId !== u.id && (
                        <button className="btn-ghost !py-1 !text-xs" onClick={() => startEdit(u)}>Edit access</button>
                      )}
                      {u.is_admin ? (
                        <button className="btn-ghost !py-1 !text-xs" disabled={busy} onClick={() => patchUser(u.id, { isAdmin: false }, "Removed admin.")} title="Remove admin">
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button className="btn-ghost !py-1 !text-xs" disabled={busy} onClick={() => patchUser(u.id, { isAdmin: true }, "Made admin.")} title="Make admin">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {u.status === "disabled" ? (
                        <button className="btn-ghost !py-1 !text-xs" disabled={busy} onClick={() => setStatus(u.id, "active", "User re-enabled.")} title="Re-enable">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button className="btn-ghost !py-1 !text-xs text-rose-300" disabled={busy} onClick={() => setStatus(u.id, "disabled", "User disabled.")} title="Disable">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 text-sm">No team members yet — add your first above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Effective access is always capped by your company plan — toggling a feature a member can&apos;t be granted has no effect.
      </p>
    </div>
  );
}
