/* ============================================================
   DISPLAY STATES — shared "what to show when there is no number"
   ------------------------------------------------------------
   Every money / usage figure in the console is rendered from what
   /api/admin/sentinel-bundle (and, later, the billing API) returns.
   Nothing in this bundle computes a total, an overage or a rate.
   When the API hasn't given us a figure we render one of these
   states instead of inventing a value.

   The same seven states exist in the client portal
   (components/DataState.tsx) so both portals look identical.

     loading                — request in flight
     empty                  — request succeeded, no rows
     disconnected           — upstream source not connected for this account
     stale                  — value exists but is older than expected
     pending                — figure exists upstream but isn't published yet
                              ("Not available yet")
     reconciliation-warning — two sources disagree; API flagged it
     unauthorized           — viewer may not see this figure
   ============================================================ */

const DATA_STATE_META = {
  loading: {
    title: "Loading…",
    description: "Fetching the latest figures.",
    pill: "Loading",
    tone: "gray",
    icon: "loader",
  },
  empty: {
    title: "Nothing here yet",
    description: "There is no data for this period.",
    pill: "No data",
    tone: "gray",
    icon: "inbox",
  },
  disconnected: {
    title: "Source not connected",
    description: "This figure depends on a data source that isn't connected yet.",
    pill: "Not connected",
    tone: "amber",
    icon: "unplug",
  },
  stale: {
    title: "Figures may be out of date",
    description: "The last successful refresh is older than expected.",
    pill: "Stale",
    tone: "amber",
    icon: "history",
  },
  pending: {
    title: "Not available yet",
    description: "This figure will appear once it is published by the billing service.",
    pill: "Not available yet",
    tone: "gray",
    icon: "hourglass",
  },
  "reconciliation-warning": {
    title: "Needs reconciliation",
    description: "Two sources report different values for this figure. Treat it as provisional.",
    pill: "Reconciliation needed",
    tone: "rose",
    icon: "scale",
  },
  unauthorized: {
    title: "Not visible for your role",
    description: "You don't have permission to view this figure.",
    pill: "Restricted",
    tone: "gray",
    icon: "lock",
  },
};

const DATA_STATE_TONE = {
  gray:  { fg: "var(--text-2)", title: "var(--text-1)", bg: "rgba(255,255,255,0.03)", border: "var(--border)", iconBg: "rgba(255,255,255,0.05)" },
  amber: { fg: "rgba(252,211,77,0.8)", title: "#fcd34d", bg: "var(--amber-soft)", border: "rgba(245,158,11,0.30)", iconBg: "rgba(245,158,11,0.16)" },
  rose:  { fg: "rgba(253,164,175,0.8)", title: "#fda4af", bg: "var(--rose-soft)", border: "rgba(244,63,94,0.32)", iconBg: "rgba(244,63,94,0.16)" },
};

/* Hairline icons for the states (kept local so primitives stay untouched). */
const StateIcon = ({ name, size = 16, spin = false, style = {} }) => {
  const paths = {
    loader:    <><path d="M12 3a9 9 0 019 9" /><path d="M21 12a9 9 0 01-9 9" opacity="0.35" /></>,
    inbox:     <><path d="M3 13l3-9h12l3 9M3 13v6h18v-6M3 13h5l2 3h4l2-3h5" /></>,
    unplug:    <><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4" /><path d="M4 20l16-16" /></>,
    history:   <><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    hourglass: <><path d="M6 3h12M6 21h12M7 3v3a5 5 0 005 5 5 5 0 005-5V3M7 21v-3a5 5 0 015-5 5 5 0 015 5v3" /></>,
    scale:     <><path d="M12 3v18M4 21h16" /><path d="M5 7h14" /><path d="M7 7l-3 7a3 3 0 006 0zM17 7l-3 7a3 3 0 006 0z" /></>,
    lock:      <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  };
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ width: size, height: size, animation: spin ? "ds-spin 900ms linear infinite" : "none", ...style }}
      aria-hidden="true"
    >
      {paths[name] || paths.hourglass}
    </svg>
  );
};

/* Block-level state. Drop it in place of a chart, a table or a card body. */
const DataState = ({ kind = "pending", title, description, detail, action, compact = false, style = {} }) => {
  const meta = DATA_STATE_META[kind] || DATA_STATE_META.pending;
  const tone = DATA_STATE_TONE[meta.tone];
  const spin = kind === "loading";

  if (compact) {
    return (
      <div role="status" data-state={kind} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: tone.fg, ...style }}>
        <StateIcon name={meta.icon} size={13} spin={spin} />
        <span style={{ fontWeight: 500, color: tone.title }}>{title || meta.title}</span>
        {description !== "" && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{description || meta.description}</span>}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-state={kind}
      className="data-state"
      style={{ background: tone.bg, borderColor: tone.border, ...style }}
    >
      <div className="data-state-icon" style={{ background: tone.iconBg, color: tone.title }}>
        <StateIcon name={meta.icon} size={20} spin={spin} />
      </div>
      <div className="data-state-title" style={{ color: tone.title }}>{title || meta.title}</div>
      {description !== "" && <div className="data-state-desc" style={{ color: tone.fg }}>{description || meta.description}</div>}
      {detail && <div className="data-state-detail">{detail}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
};

/* Inline pill for table cells and headers. */
const DataStatePill = ({ kind = "pending", label, title }) => {
  const meta = DATA_STATE_META[kind] || DATA_STATE_META.pending;
  const tone = DATA_STATE_TONE[meta.tone];
  return (
    <span
      className="badge ds-pill"
      data-state={kind}
      title={title || meta.description}
      style={{ color: tone.title, background: tone.bg, borderColor: tone.border }}
    >
      <StateIcon name={meta.icon} size={11} spin={kind === "loading"} />
      {label || meta.pill}
    </span>
  );
};

/* Placeholder for a single number (KPI value, table cell). */
const NotAvailable = ({ kind = "pending", label, style = {} }) => {
  const meta = DATA_STATE_META[kind] || DATA_STATE_META.pending;
  return (
    <span className="na-value" data-state={kind} title={meta.description} style={style}>
      <span aria-hidden="true" className="na-dash">—</span>
      <span className="na-tag">{label || meta.pill}</span>
    </span>
  );
};

/* KPI card whose value isn't available. Keeps the grid layout intact. */
const KpiUnavailable = ({ label, kind = "pending", hint, tint }) => {
  const meta = DATA_STATE_META[kind] || DATA_STATE_META.pending;
  return (
    <div className={"kpi anim-in" + (tint ? " tint-" + tint : "")} data-state={kind}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value"><NotAvailable kind={kind} /></div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{hint || meta.description}</div>
    </div>
  );
};

/* A control that exists in the design but has no working backend yet. */
const UnavailableControl = ({ children, reason = "Not available yet", className = "btn btn-secondary btn-xs", style = {}, showReason = true }) => (
  <button
    type="button"
    disabled
    aria-disabled="true"
    title={reason}
    data-unavailable="true"
    className={className + " is-unavailable"}
    style={style}
  >
    {children}
    {showReason && <span className="na-tag" style={{ marginLeft: 4 }}>· {reason}</span>}
  </button>
);

/* Money helper that refuses to print a number we don't have. Returns null
   for null/undefined/NaN so callers can fall back to <NotAvailable />. */
const fmtMoneyOrNull = (n) => (n == null || Number.isNaN(Number(n)) ? null : fmtMoney(n));
const Money = ({ value, kind = "pending", label }) => {
  const s = fmtMoneyOrNull(value);
  return s == null ? <NotAvailable kind={kind} label={label} /> : <>{s}</>;
};

Object.assign(window, {
  DATA_STATE_META,
  StateIcon,
  DataState,
  DataStatePill,
  NotAvailable,
  KpiUnavailable,
  UnavailableControl,
  fmtMoneyOrNull,
  Money,
});
