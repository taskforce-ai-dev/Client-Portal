/* ============================================================
   PRIMITIVES — shared components
   ============================================================ */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ---------- Icons (inline SVG, hairline) ---------- */
const Icon = ({ name, size = 14, className = "", style = {} }) => {
  const s = { width: size, height: size, ...style };
  const stroke = "currentColor";
  const sw = 1.5;
  const paths = {
    dashboard: <><path d="M3 3h7v9H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 15h7v6H3z" /></>,
    activity: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14c2.5 0 5 1.5 5 4" /></>,
    "user-plus": <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M19 8v6M16 11h6" /></>,
    check: <><path d="M4 12l5 5L20 6" /></>,
    block: <><circle cx="12" cy="12" r="9" /><path d="M5 5l14 14" /></>,
    money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></>,
    invoice: <><path d="M5 3h11l3 3v15a1 1 0 01-1 1H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l3-3 4 4 6-7" /></>,
    warn: <><path d="M12 3l10 17H2z" /><path d="M12 10v4M12 17v.5" /></>,
    config: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a7.4 7.4 0 00.1-3l2-1.5-2-3.5-2.4 1a7.4 7.4 0 00-2.6-1.5L14 4h-4l-.5 2.5a7.4 7.4 0 00-2.6 1.5l-2.4-1-2 3.5L4.5 12a7.4 7.4 0 00.1 3l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 002.6 1.5L10 23h4l.5-2.5a7.4 7.4 0 002.6-1.5l2.4 1 2-3.5z" /></>,
    book: <><path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 014 17.5z" /><path d="M4 17.5A2.5 2.5 0 016.5 15H20" /></>,
    health: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    ticket: <><path d="M3 8a2 2 0 002-2V4h14v2a2 2 0 000 4v8a2 2 0 002 2v0H5v0a2 2 0 002-2v-8a2 2 0 00-2-2zm10-4v16" /></>,
    megaphone: <><path d="M3 11v2a1 1 0 001 1h2l8 5V5L6 10H4a1 1 0 00-1 1z" /><path d="M18 8a4 4 0 010 8" /></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a7.4 7.4 0 00.1-3l2-1.5-2-3.5-2.4 1a7.4 7.4 0 00-2.6-1.5L14 4h-4l-.5 2.5a7.4 7.4 0 00-2.6 1.5l-2.4-1-2 3.5L4.5 12a7.4 7.4 0 00.1 3l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 002.6 1.5L10 23h4l.5-2.5a7.4 7.4 0 002.6-1.5l2.4 1 2-3.5z" /></>,
    log: <><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 12h6M9 15h4" /></>,
    bell: <><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 004 0" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="M16 16l5 5" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" /></>,
    plus: <><path d="M12 4v16M4 12h16" /></>,
    x: <><path d="M6 6l12 12M18 6L6 18" /></>,
    chevron: <><path d="M9 6l6 6-6 6" /></>,
    download: <><path d="M12 3v13M6 11l6 6 6-6M5 21h14" /></>,
    refresh: <><path d="M3 12a9 9 0 0115-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    dots: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
    edit: <><path d="M4 20h4l12-12-4-4L4 16z" /></>,
    arrow_up: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
    arrow_down: <><path d="M12 5v14M5 12l7 7 7-7" /></>,
    inbox: <><path d="M3 13l3-9h12l3 9M3 13v6h18v-6M3 13h5l2 3h4l2-3h5" /></>,
    sliders: <><path d="M3 6h13M19 6h2M3 12h5M11 12h10M3 18h9M15 18h6" /><circle cx="17.5" cy="6" r="1.5" /><circle cx="9.5" cy="12" r="1.5" /><circle cx="13.5" cy="18" r="1.5" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    filter: <><path d="M3 5h18l-7 9v6l-4-2v-4z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={s} className={className}>
      {paths[name]}
    </svg>
  );
};

/* ---------- Status dot + label ---------- */
const StatusDot = ({ status }) => {
  const map = {
    Active:    { cls: "emerald", label: "Active" },
    Trial:     { cls: "amber",   label: "Trial" },
    Overdue:   { cls: "rose pulse", label: "Overdue" },
    Blocked:   { cls: "gray",    label: "Blocked" },
    Churned:   { cls: "gray",    label: "Churned" },
    Suspended: { cls: "gray",    label: "Suspended" },
    Paid:      { cls: "emerald", label: "Paid" },
    Pending:   { cls: "amber",   label: "Pending" },
    Failed:    { cls: "rose",    label: "Failed" },
    Refunded:  { cls: "gray",    label: "Refunded" },
    Operational: { cls: "emerald", label: "Operational" },
    Degraded:    { cls: "amber",   label: "Degraded" },
    Outage:      { cls: "rose pulse", label: "Outage" },
    Open:        { cls: "rose",    label: "Open" },
    "In Progress": { cls: "amber", label: "In Progress" },
    "Waiting on Client": { cls: "sky", label: "Waiting on Client" },
    Resolved:    { cls: "emerald", label: "Resolved" },
    Closed:      { cls: "gray",    label: "Closed" },
    Ongoing:     { cls: "rose pulse", label: "Ongoing" },
  };
  const s = map[status] || { cls: "gray", label: status };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "var(--ff-mono)", fontSize: 12 }}>
      <span className={"dot " + s.cls} />
      {s.label}
    </span>
  );
};

/* ---------- Plan badge ---------- */
const PlanBadge = ({ plan }) => {
  const cls = { Starter: "badge-starter", Growth: "badge-growth", Pro: "badge-pro", Enterprise: "badge-enterprise" }[plan] || "badge-starter";
  return <span className={"badge " + cls}>{plan}</span>;
};

/* ---------- Status badge (for payments) ---------- */
const StatusBadge = ({ status }) => {
  const cls = {
    Paid: "badge-paid", Pending: "badge-pending", Overdue: "badge-overdue",
    Failed: "badge-failed", Refunded: "badge-refunded",
  }[status] || "badge-pending";
  return <span className={"badge " + cls}>{status}</span>;
};

/* ---------- KPI card ---------- */
const KpiCard = ({ label, value, delta, deltaKind = "up", subtitle, tint, suffix, prefix = "" }) => {
  return (
    <div className={"kpi anim-in" + (tint ? " tint-" + tint : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{prefix}{value}{suffix}</div>
      {(delta || subtitle) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          {delta && (
            <span className={"kpi-delta " + deltaKind}>
              <Icon name={deltaKind === "down" ? "arrow_down" : "arrow_up"} size={11} />
              {delta}
            </span>
          )}
          {subtitle && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

/* ---------- Section header ---------- */
const SectionHeader = ({ title, action, subtitle }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid var(--border)" }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)", letterSpacing: "-0.005em" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

/* ---------- Sidebar ---------- */
const NAV = [
  { section: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "activity",  label: "Live Activity", icon: "activity" },
  ]},
  { section: "Clients", items: [
    { id: "clients",   label: "All Clients", icon: "users" },
    { id: "new-client",label: "New Client",  icon: "user-plus" },
    { id: "pending",   label: "Pending Approvals", icon: "check", count: 3 },
    { id: "blocked",   label: "Blocked Accounts",  icon: "block", count: 1 },
  ]},
  { section: "Financials", items: [
    { id: "payments",  label: "Payments", icon: "money" },
    { id: "invoices",  label: "Invoices", icon: "invoice" },
    { id: "earnings",  label: "Earnings", icon: "chart" },
    { id: "overdue",   label: "Delayed / Overdue", icon: "warn", count: 2 },
  ]},
  { section: "Platform", items: [
    { id: "agents",    label: "Agent Configs", icon: "config" },
    { id: "kb",        label: "Knowledge Base", icon: "book" },
    { id: "health",    label: "System Health",  icon: "health" },
  ]},
  { section: "Support", items: [
    { id: "tickets",   label: "Help Tickets", icon: "ticket", count: 4 },
    { id: "announce",  label: "Send Announcement", icon: "megaphone" },
  ]},
  { section: "Settings", items: [
    { id: "admins",    label: "Admin Users",    icon: "shield" },
    { id: "config",    label: "Platform Config", icon: "settings" },
    { id: "audit",     label: "Audit Log",      icon: "log" },
  ]},
];

const Sidebar = ({ active, onNavigate }) => (
  <aside className="sidebar">
    <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px rgba(239,68,68,0.4), 0 0 14px rgba(239,68,68,0.35)"
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Sentinel</div>
          <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--ff-mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Super Admin</div>
        </div>
      </div>
    </div>

    <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 14px" }}>
      {NAV.map((sec) => (
        <div key={sec.section} className="nav-section">
          <div className="nav-section-label">{sec.section}</div>
          {sec.items.map((it) => (
            <div
              key={it.id}
              className={"nav-item" + (active === it.id ? " active" : "")}
              onClick={() => onNavigate(it.id)}
            >
              <Icon name={it.icon} size={14} />
              <span>{it.label}</span>
              {it.count && <span className="nav-count">{it.count}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>

    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="dot emerald" style={{ marginRight: 0 }} />
        <span>build 4.218 · stable</span>
      </div>
    </div>
  </aside>
);

/* ---------- Header bar ---------- */
const HeaderBar = ({ title, onSearch }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="header-bar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
        <span style={{ color: "var(--text-3)", fontSize: 12, fontFamily: "var(--ff-mono)" }}>·</span>
        <span style={{ color: "var(--text-3)", fontSize: 11.5, fontFamily: "var(--ff-mono)" }}>
          {now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC
        </span>
      </div>

      <div className="searchbar" style={{ width: 280, marginRight: 14 }}>
        <Icon name="search" size={13} className="text-3" style={{ color: "var(--text-3)" }} />
        <input placeholder="Search clients, invoices, tickets…" onClick={onSearch} readOnly />
        <span className="kbd">⌘K</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 14, fontSize: 11.5, fontFamily: "var(--ff-mono)", color: "#6ee7b7" }}>
          <span className="dot emerald" style={{ marginRight: 0 }} />
          <span>All systems operational</span>
        </div>

        <button className="btn btn-ghost btn-sm" style={{ position: "relative", padding: "5px 8px" }}>
          <Icon name="bell" size={15} />
          <span style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, background: "var(--rose)", borderRadius: "50%" }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="avatar">MR</div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Maya Reyes</div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>Super Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Toast manager ---------- */
const ToastContext = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, kind = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.kind}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

/* ---------- Confirm modal (typed confirmation) ---------- */
const ConfirmDialog = ({ title, description, confirmWord, confirmLabel = "Confirm — irreversible", danger = true, onConfirm, onCancel }) => {
  const [val, setVal] = useState("");
  const valid = !confirmWord || val.trim() === confirmWord;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 14 }}>{description}</div>
        {confirmWord && (
          <>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 6 }}>
              Type <span className="mono" style={{ color: "var(--red-300)" }}>{confirmWord}</span> to confirm.
            </div>
            <input className="input mono" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className={"btn btn-sm " + (danger ? "btn-danger" : "btn-primary")}
            disabled={!valid}
            style={!valid ? { opacity: 0.4, cursor: "not-allowed" } : {}}
            onClick={() => valid && onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Sparkline (mini SVG) ---------- */
const Sparkline = ({ data, width = 60, height = 18, color = "var(--red-400)", filled = true }) => {
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 2) - 1]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" width={width} height={height}>
      {filled && <path d={area} fill={color} opacity="0.15" />}
      <path d={path} stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ---------- Command Palette (Cmd+K) ---------- */
const CommandPalette = ({ open, onClose, onNavigate }) => {
  const [q, setQ] = useState("");
  if (!open) return null;
  const items = [
    { label: "Go to Dashboard", action: () => onNavigate("dashboard"), group: "Navigate" },
    { label: "All Clients",      action: () => onNavigate("clients"),   group: "Navigate" },
    { label: "Payments",         action: () => onNavigate("payments"),  group: "Navigate" },
    { label: "Help Tickets",     action: () => onNavigate("tickets"),   group: "Navigate" },
    { label: "Audit Log",        action: () => onNavigate("audit"),     group: "Navigate" },
    ...CLIENTS.map((c) => ({ label: c.company, sub: c.id + " · " + c.email, action: () => onNavigate("clients"), group: "Clients" })),
    ...TICKETS.slice(0, 5).map((t) => ({ label: t.id + " · " + t.subject, sub: t.client, action: () => onNavigate("tickets"), group: "Tickets" })),
  ];
  const filtered = q ? items.filter((i) => (i.label + " " + (i.sub || "")).toLowerCase().includes(q.toLowerCase())) : items;
  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: "flex-start", paddingTop: 80 }}>
      <div className="modal" style={{ width: 540, padding: 0, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="search" size={14} style={{ color: "var(--text-3)" }} />
          <input className="input" style={{ background: "transparent", border: "none", padding: 0 }} placeholder="Search anything…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <span className="kbd">esc</span>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: 4 }}>
          {filtered.slice(0, 12).map((it, i) => (
            <div key={i} className="menu-item" onClick={() => { it.action(); onClose(); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5 }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{it.sub}</div>}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{it.group}</span>
            </div>
          ))}
          {!filtered.length && <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No results.</div>}
        </div>
      </div>
    </div>
  );
};

/* ---------- Empty state ---------- */
const EmptyState = ({ icon = "inbox", title, description, action }) => (
  <div style={{ padding: "48px 24px", textAlign: "center" }}>
    <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
      <Icon name={icon} size={26} />
    </div>
    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>{title}</div>
    {description && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{description}</div>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

/* ---------- Recharts shared tooltip ---------- */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tooltip">
      <div style={{ color: "var(--text-3)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: p.color, borderRadius: 2 }} />
          <span style={{ color: "var(--text-1)", textTransform: "capitalize" }}>{p.name}:</span>
          <span style={{ color: "var(--text-0)" }}>{typeof p.value === "number" ? "$" + p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, {
  Icon, StatusDot, PlanBadge, StatusBadge, KpiCard, SectionHeader,
  Sidebar, HeaderBar, ToastProvider, useToast, ConfirmDialog,
  Sparkline, CommandPalette, EmptyState, ChartTooltip,
  NAV,
});
