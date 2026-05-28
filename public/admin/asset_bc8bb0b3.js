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

const AdminUsersPage = () => {
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Operations");
  const [reminders, setReminders] = useState({ pre3: true, due: true, post3: true, post7: false });
  const toast = useToast();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 14 }}>
      {/* LEFT: Admin users */}
      <div className="panel">
        <SectionHeader
          title="Admin users"
          subtitle={`${ADMIN_USERS.filter(u => u.status === "Active").length} active admins · ${ADMIN_USERS.length} total`}
          action={<button className="btn btn-primary btn-sm" onClick={() => setInviting(!inviting)}><Icon name="plus" size={12} />Invite admin</button>}
        />

        {inviting && (
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", background: "rgba(239,68,68,0.04)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="admin@sentinel.ops" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
              <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ width: 150 }}>
                <option>Super Admin</option><option>Operations</option><option>Finance</option><option>Support</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => { toast("Invite sent to " + inviteEmail, "success"); setInviting(false); setInviteEmail(""); }}>Send invite</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setInviting(false)}><Icon name="x" size={12} /></button>
            </div>
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Last login</th>
              <th>Status</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_USERS.map((u) => (
              <tr key={u.email}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5 }}>{u.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
                    <div>
                      <div style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{u.name}</div>
                      <div style={{ color: "var(--text-3)", fontSize: 10.5 }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: 10.5, fontFamily: "var(--ff-mono)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em",
                    background: u.role === "Super Admin" ? "rgba(239,68,68,0.14)" : u.role === "Finance" ? "rgba(245,158,11,0.14)" : u.role === "Support" ? "rgba(56,189,248,0.14)" : "rgba(107,114,128,0.14)",
                    color:      u.role === "Super Admin" ? "#fca5a5" :              u.role === "Finance" ? "#fcd34d" :                u.role === "Support" ? "#7dd3fc" :                "#d1d5db",
                    border: "1px solid currentColor", borderColor: u.role === "Super Admin" ? "rgba(239,68,68,0.3)" : u.role === "Finance" ? "rgba(245,158,11,0.3)" : u.role === "Support" ? "rgba(56,189,248,0.3)" : "rgba(107,114,128,0.3)"
                  }}>{u.role}</span>
                </td>
                <td style={{ color: "var(--text-2)" }}>{u.lastLogin}</td>
                <td>
                  <StatusDot status={u.status === "Active" ? "Active" : "Blocked"} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-xs">Edit</button>
                    <button className="btn btn-ghost btn-xs">Reset pw</button>
                    {u.status === "Active" && <button className="btn btn-danger btn-xs">Revoke</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
