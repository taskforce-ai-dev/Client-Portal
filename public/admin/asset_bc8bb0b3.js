/* ============================================================
   SETTINGS — Audit Log + Admin Users + Platform Config
   ============================================================ */

const ACTION_TYPE_META = {
  created:   { color: "var(--emerald)", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)",  label: "Created" },
  modified:  { color: "var(--sky)",     bg: "rgba(56,189,248,0.10)",  border: "rgba(56,189,248,0.25)",  label: "Modified" },
  blocked:   { color: "var(--rose)",    bg: "rgba(244,63,94,0.12)",   border: "rgba(244,63,94,0.30)",   label: "Blocked" },
  financial: { color: "var(--amber)",   bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)",  label: "Financial" },
  auth:      { color: "var(--text-2)",  bg: "rgba(107,114,128,0.10)", border: "rgba(107,114,128,0.25)", label: "Auth" },
};

const AuditLogPage = () => {
  const [adminF, setAdminF] = useState("All");
  const [typeF, setTypeF] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = AUDIT_LOG.filter((l) =>
    (adminF === "All" || l.admin === adminF) &&
    (typeF === "All" || l.type === typeF) &&
    (!query || (l.action + l.target + l.details).toLowerCase().includes(query.toLowerCase()))
  );

  const counts = {
    created:   AUDIT_LOG.filter((l) => l.type === "created").length,
    modified:  AUDIT_LOG.filter((l) => l.type === "modified").length,
    blocked:   AUDIT_LOG.filter((l) => l.type === "blocked").length,
    financial: AUDIT_LOG.filter((l) => l.type === "financial").length,
    auth:      AUDIT_LOG.filter((l) => l.type === "auth").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Type chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Object.entries(ACTION_TYPE_META).map(([key, m]) => (
          <button
            key={key}
            className="panel-flat"
            onClick={() => setTypeF(typeF === key ? "All" : key)}
            style={{
              padding: "10px 14px",
              cursor: "pointer",
              flex: 1,
              minWidth: 130,
              borderColor: typeF === key ? m.border : "var(--border)",
              background: typeF === key ? m.bg : undefined,
              textAlign: "left",
            }}>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color }} />
              {m.label}
            </div>
            <div style={{ fontFamily: "var(--ff-mono)", fontSize: 18, color: "var(--text-0)", marginTop: 4 }}>{counts[key]}</div>
          </button>
        ))}
      </div>

      <div className="panel">
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="searchbar" style={{ width: 260 }}>
            <Icon name="search" size={13} style={{ color: "var(--text-3)" }} />
            <input placeholder="Search action, target, IP…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="input" style={{ width: 150 }} value={adminF} onChange={(e) => setAdminF(e.target.value)}>
            <option>All</option>{ADMIN_USERS.map((u) => <option key={u.name}>{u.name.split(" ")[0] + " " + (u.name.split(" ")[1]?.[0] || "") + "."}</option>)}<option>System</option>
          </select>
          <input className="input mono" type="date" defaultValue="2026-05-23" style={{ width: 150 }} />
          <input className="input" placeholder="Client filter…" style={{ width: 180 }} />
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm"><Icon name="download" size={12} />Export CSV</button>
        </div>

        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 170 }}>Timestamp</th>
                <th style={{ width: 110 }}>Admin</th>
                <th style={{ width: 170 }}>Action</th>
                <th>Target</th>
                <th style={{ width: 130 }}>IP</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const m = ACTION_TYPE_META[l.type];
                return (
                  <tr key={i}>
                    <td style={{ color: "var(--text-2)" }}>{l.ts}</td>
                    <td style={{ color: l.admin === "System" ? "var(--text-3)" : "var(--text-0)", fontFamily: l.admin === "System" ? "var(--ff-mono)" : "var(--ff-sans)" }}>
                      {l.admin === "System" ? "system" : l.admin}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 4, background: m.bg, border: `1px solid ${m.border}`, color: m.color, fontSize: 11 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color }} />
                        {l.action}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{l.target}</td>
                    <td style={{ color: "var(--text-2)" }}>{l.ip}</td>
                    <td style={{ color: "var(--text-2)" }}>{l.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>
          ↓ scroll for more · {filtered.length} of 1,248 entries shown
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   ADMIN USERS + PLATFORM CONFIG
   ============================================================ */

const adminPwWordsA = ["Cedar", "Falcon", "Harbor", "Aspen", "Lumen", "Vertex", "Cobalt", "Onyx", "Maple", "Nimbus"];
const adminPwWordsB = ["Otter", "Comet", "Ridge", "Delta", "Pine", "Ember", "Lynx", "Reef", "Sage", "Hawk"];
const suggestAdminPassword = () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return pick(adminPwWordsA) + "-" + pick(adminPwWordsB) + "-" + Math.floor(1000 + Math.random() * 9000);
};
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || "").trim());

const AdminUsersPage = () => {
  const [admins, setAdmins] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reminders, setReminders] = useState({ pre3: true, due: true, post3: true, post7: false });
  // Inline reset-password panel: `resetting` holds the admin being edited
  // (null when closed). `resetPw` is the typed password.
  const [resetting, setResetting] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetErr, setResetErr] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const toast = useToast();

  const refresh = () =>
    fetch("/api/admin/admins", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAdmins(Array.isArray(d) ? d : []))
      .catch(() => setAdmins([]));

  useEffect(() => { refresh(); }, []);

  const startInvite = () => {
    setForm({ name: "", email: "", password: "" });
    setErr(""); setCreated(null); setInviting(true);
  };

  const sendInvite = async () => {
    setErr("");
    if (!isValidEmail(form.email)) { setErr("Enter a valid email address."); return; }
    if (!form.password || form.password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/admins", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      setCreated({ email: form.email.trim().toLowerCase(), password: form.password });
      setInviting(false);
      refresh();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const revoke = async (a) => {
    try {
      const r = await fetch(`/api/admin/admins/${a.id}`, { method: "DELETE", credentials: "include" });
      const d = r.ok ? { ok: true } : await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      toast("Revoked " + a.email, "warn");
      setConfirm(null);
      refresh();
    } catch (e) { toast(e.message, "error"); setConfirm(null); }
  };

  const startReset = (a) => {
    setResetting(a);
    setResetPw("");
    setResetErr("");
    setCreated(null);
    setInviting(false);
  };

  const cancelReset = () => { setResetting(null); setResetPw(""); setResetErr(""); };

  const saveReset = async () => {
    setResetErr("");
    if (!resetPw || resetPw.length < 8) { setResetErr("Password must be at least 8 characters."); return; }
    setResetBusy(true);
    try {
      const r = await fetch(`/api/admin/admins/${resetting.id}/password`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify({ password: resetPw }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      setCreated({ email: resetting.email, password: resetPw });
      toast("Password reset for " + resetting.email, "success");
      setResetting(null);
      setResetPw("");
    } catch (e) { setResetErr(e.message); } finally { setResetBusy(false); }
  };

  const list = admins || [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 14 }}>
      {/* LEFT: Admin users */}
      <div className="panel">
        <SectionHeader
          title="Admin users"
          subtitle={admins === null ? "Loading…" : `${list.length} ${list.length === 1 ? "admin" : "admins"}`}
          action={<button className="btn btn-primary btn-sm" onClick={startInvite}><Icon name="plus" size={12} />Invite admin</button>}
        />

        {inviting && (
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", background: "rgba(239,68,68,0.04)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Name (optional)"><input className="input" placeholder="Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email"><input className="input mono" type="email" placeholder="admin@taskforceai.tech" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <Field label="Password (type your own, min 8 chars · or click ↻ to suggest one · stored hashed)">
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Type a password (min 8 chars)" style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-sm" title="Suggest a strong password" onClick={() => setForm({ ...form, password: suggestAdminPassword() })}>↻</button>
                <button type="button" className="btn btn-secondary btn-sm" title="Copy" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(form.password); toast("Password copied", "success"); }}>Copy</button>
              </div>
            </Field>
            {err && <div style={{ color: "#ff8585", fontSize: 12.5 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setInviting(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={sendInvite}>{busy ? "Creating…" : "Create admin"}</button>
            </div>
          </div>
        )}

        {resetting && (
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", background: "rgba(167,139,250,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>Reset password</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                  for <span className="mono" style={{ color: "var(--text-1)" }}>{resetting.email}</span>
                  {resetting.name ? " · " + resetting.name : ""}
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={cancelReset}>✕ Close</button>
            </div>
            <Field label="New password (type your own, min 8 chars · or click ↻ to suggest one · stored hashed)">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input mono"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  placeholder="Type a new password (min 8 chars)"
                  autoFocus
                  style={{ flex: 1 }}
                  onKeyDown={(e) => { if (e.key === "Enter") saveReset(); }}
                />
                <button type="button" className="btn btn-secondary btn-sm" title="Suggest a strong password" onClick={() => setResetPw(suggestAdminPassword())}>↻</button>
                <button type="button" className="btn btn-secondary btn-sm" title="Copy" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(resetPw); toast("Password copied", "success"); }}>Copy</button>
              </div>
            </Field>
            {resetErr && <div style={{ color: "#ff8585", fontSize: 12.5 }}>{resetErr}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={cancelReset}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={resetBusy} onClick={saveReset}>{resetBusy ? "Saving…" : "Save new password"}</button>
            </div>
          </div>
        )}

        {created && (
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", background: "rgba(0,229,160,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--emerald)" }}>Admin credentials ready ✓</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Share these with the admin — they sign in at /admin/login.</div>
            <div style={{ fontFamily: "var(--ff-mono)", fontSize: 12.5, marginTop: 8, lineHeight: 1.9 }}>
              <div>Email: {created.email}</div>
              <div>Password: {created.password}</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button className="btn btn-secondary btn-xs" onClick={() => { navigator.clipboard && navigator.clipboard.writeText("Email: " + created.email + "\nPassword: " + created.password); toast("Credentials copied", "success"); }}>Copy credentials</button>
              <button className="btn btn-ghost btn-xs" onClick={() => setCreated(null)}>Dismiss</button>
            </div>
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Created</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins === null && (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--text-3)" }}>Loading…</td></tr>
            )}
            {admins !== null && list.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--text-3)" }}>No admins yet — invite the first one above.</td></tr>
            )}
            {list.map((a) => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5 }}>{(a.name || a.email).split(/[\s.@]+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>
                    <div style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{a.name || "—"}</div>
                  </div>
                </td>
                <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)", fontSize: 11.5 }}>{a.email}</td>
                <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)", fontSize: 11.5 }}>{a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => startReset(a)}>Reset password</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm(a)}>Revoke</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {confirm && (
          <ConfirmDialog
            title={`Revoke ${confirm.email}?`}
            description="This admin will lose access immediately. They won't be able to sign in. You can re-invite them later."
            confirmWord={confirm.email}
            confirmLabel="Revoke admin"
            onConfirm={() => revoke(confirm)}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>

      {/* RIGHT: Platform config */}
      <div className="panel">
        <SectionHeader title="Platform configuration" subtitle="System-wide settings & defaults" />
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Platform name"><input className="input" defaultValue="Sentinel" /></Field>
            <Field label="Support email"><input className="input mono" defaultValue="support@sentinel.ops" /></Field>
            <Field label="Default currency"><select className="input"><option>USD</option><option>EUR</option><option>GBP</option><option>SGD</option></select></Field>
            <Field label="Invoice prefix"><input className="input mono" defaultValue="INV-" /></Field>
          </div>

          <Field label="Invoice footer">
            <textarea className="input" rows={2} defaultValue="Sentinel Platform Inc. — 100 Market St, San Francisco, CA · invoices@sentinel.ops" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Trial period (days)"><input className="input mono" defaultValue="14" /></Field>
            <Field label="Grace period (days)"><input className="input mono" defaultValue="7" /></Field>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Auto-reminder schedule</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["pre3",  "3 days before due"],
                ["due",   "On due date"],
                ["post3", "3 days overdue"],
                ["post7", "7 days overdue (final notice)"],
              ].map(([k, l]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12.5 }} onClick={() => setReminders({ ...reminders, [k]: !reminders[k] })}>
                  <div className={"toggle " + (reminders[k] ? "on" : "")} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Payment webhook URL">
            <div style={{ display: "flex", gap: 6 }}>
              <input className="input mono" defaultValue="https://hooks.sentinel.ops/payments/v2" style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={() => toast("Test webhook fired — 200 OK", "success")}>Test</button>
            </div>
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 6 }}>
            <button className="btn btn-ghost btn-sm">Discard</button>
            <button className="btn btn-primary btn-sm" onClick={() => toast("Settings saved", "success")}>Save settings</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   PAGE STUB — for sections without a custom page
   ============================================================ */
const PageStub = ({ title, description, icon = "inbox" }) => (
  <div className="panel" style={{ padding: 80 }}>
    <EmptyState icon={icon} title={title} description={description} action={<button className="btn btn-secondary btn-sm">Configure</button>} />
  </div>
);

Object.assign(window, { AuditLogPage, AdminUsersPage, PageStub });
