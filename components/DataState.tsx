import type { ReactNode } from "react";
import {
  History,
  Hourglass,
  Inbox,
  Loader2,
  Lock,
  Scale,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import clsx from "clsx";

// Reusable display states for anything that renders billing / usage / money
// numbers in the client portal. These components render whatever state the
// API reports — they never compute a number themselves.
//
//   loading                  — request in flight, nothing to show yet
//   empty                    — request succeeded, there is simply no data
//   disconnected             — the upstream source (DB, voice provider, billing
//                              API) is not connected for this account
//   stale                    — we have a value but it is older than expected
//   pending                  — the figure exists upstream but is not published
//                              to this UI yet ("Not available yet")
//   reconciliation-warning   — two sources disagree; the API flagged it
//   unauthorized             — the viewer may not see this figure
//
// The same seven states exist in the super-admin bundle
// (public/admin/asset_display_states.js) so both portals look identical.

export type DataStateKind =
  | "loading"
  | "empty"
  | "disconnected"
  | "stale"
  | "pending"
  | "reconciliation-warning"
  | "unauthorized";

type Tone = "slate" | "amber" | "rose" | "accent";

type Meta = {
  title: string;
  description: string;
  Icon: typeof Inbox;
  tone: Tone;
  pill: string;
};

export const DATA_STATE_META: Record<DataStateKind, Meta> = {
  loading: {
    title: "Loading…",
    description: "Fetching the latest figures.",
    Icon: Loader2,
    tone: "slate",
    pill: "Loading",
  },
  empty: {
    title: "Nothing here yet",
    description: "There is no data for this period.",
    Icon: Inbox,
    tone: "slate",
    pill: "No data",
  },
  disconnected: {
    title: "Source not connected",
    description: "This figure depends on a data source that isn't connected for this account yet.",
    Icon: Unplug,
    tone: "amber",
    pill: "Not connected",
  },
  stale: {
    title: "Figures may be out of date",
    description: "The last successful refresh is older than expected.",
    Icon: History,
    tone: "amber",
    pill: "Stale",
  },
  pending: {
    title: "Not available yet",
    description: "This figure will appear once it is published by the billing service.",
    Icon: Hourglass,
    tone: "slate",
    pill: "Not available yet",
  },
  "reconciliation-warning": {
    title: "Needs reconciliation",
    description: "Two sources report different values for this figure. Treat it as provisional.",
    Icon: Scale,
    tone: "rose",
    pill: "Reconciliation needed",
  },
  unauthorized: {
    title: "Not visible for your role",
    description: "You don't have permission to view this figure.",
    Icon: Lock,
    tone: "slate",
    pill: "Restricted",
  },
};

const TONE_BLOCK: Record<Tone, { box: string; icon: string; title: string; body: string }> = {
  slate: {
    box: "border-white/10 bg-white/[0.02]",
    icon: "bg-white/[0.06] text-slate-300",
    title: "text-slate-200",
    body: "text-slate-400",
  },
  amber: {
    box: "border-amber-500/25 bg-amber-500/[0.05]",
    icon: "bg-amber-500/15 text-amber-300",
    title: "text-amber-200",
    body: "text-amber-200/75",
  },
  rose: {
    box: "border-rose-500/30 bg-rose-500/[0.06]",
    icon: "bg-rose-500/15 text-rose-300",
    title: "text-rose-200",
    body: "text-rose-200/75",
  },
  accent: {
    box: "border-accent-500/25 bg-accent-500/[0.05]",
    icon: "bg-accent-500/15 text-accent-300",
    title: "text-accent-200",
    body: "text-accent-200/75",
  },
};

const TONE_PILL: Record<Tone, string> = {
  slate: "pill-slate",
  amber: "pill-amber",
  rose: "pill-rose",
  accent: "pill-accent",
};

/**
 * Block-level state. Drop it in place of a chart, a table, or a card body.
 * `compact` renders a single-line row (good inside a card header).
 */
export function DataState({
  kind,
  title,
  description,
  detail,
  action,
  compact = false,
  className,
}: {
  kind: DataStateKind;
  title?: string;
  description?: string;
  /** Raw detail from the API (an error string, a timestamp). Rendered monospace. */
  detail?: string | null;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const meta = DATA_STATE_META[kind];
  const tone = TONE_BLOCK[meta.tone];
  const Icon = meta.Icon;
  const spin = kind === "loading";

  if (compact) {
    return (
      <div
        role="status"
        data-state={kind}
        className={clsx("flex items-center gap-2 text-xs", tone.body, className)}
      >
        <Icon className={clsx("w-3.5 h-3.5 shrink-0", spin && "animate-spin")} />
        <span className={clsx("font-medium", tone.title)}>{title ?? meta.title}</span>
        {description !== "" && <span className="truncate">{description ?? meta.description}</span>}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-state={kind}
      className={clsx("card p-4 border flex items-start gap-3", tone.box, className)}
    >
      <div className={clsx("w-9 h-9 rounded-xl grid place-items-center shrink-0", tone.icon)}>
        <Icon className={clsx("w-4 h-4", spin && "animate-spin")} />
      </div>
      <div className="text-sm min-w-0 flex-1">
        <div className={clsx("font-medium", tone.title)}>{title ?? meta.title}</div>
        {description !== "" && (
          <div className={clsx("text-xs mt-0.5", tone.body)}>{description ?? meta.description}</div>
        )}
        {detail && <div className="text-[11px] mt-1 font-mono break-all text-slate-500">{detail}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** Inline pill, for table cells and card headers. */
export function DataStatePill({
  kind,
  label,
  title,
}: {
  kind: DataStateKind;
  label?: string;
  title?: string;
}) {
  const meta = DATA_STATE_META[kind];
  const Icon = meta.Icon;
  return (
    <span className={TONE_PILL[meta.tone]} title={title ?? meta.description} data-state={kind}>
      <Icon className={clsx("w-3 h-3", kind === "loading" && "animate-spin")} />
      {label ?? meta.pill}
    </span>
  );
}

/**
 * Placeholder for a single number (a KPI value, a table cell). Use it wherever
 * a figure would normally be printed but the API hasn't provided one.
 */
export function ValueUnavailable({
  kind = "pending",
  label,
  className,
}: {
  kind?: DataStateKind;
  label?: string;
  className?: string;
}) {
  const meta = DATA_STATE_META[kind];
  return (
    <span
      data-state={kind}
      title={meta.description}
      className={clsx("inline-flex items-baseline gap-1.5 text-slate-500", className)}
    >
      <span aria-hidden className="font-mono">—</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.06em]">{label ?? meta.pill}</span>
    </span>
  );
}

/**
 * KPI card whose value is not available. Keeps the card in the grid so the
 * layout doesn't shift when the real figure lands.
 */
export function KpiUnavailable({
  label,
  kind = "pending",
  hint,
  highlight,
}: {
  label: string;
  kind?: DataStateKind;
  hint?: string;
  highlight?: boolean;
}) {
  const meta = DATA_STATE_META[kind];
  return (
    <div className={clsx("card p-4", highlight && "ring-1 ring-white/10")} data-state={kind}>
      <div className="stat-label">{label}</div>
      <div className="text-lg font-semibold mt-1">
        <ValueUnavailable kind={kind} />
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{hint ?? meta.description}</div>
    </div>
  );
}

/**
 * A control that exists in the design but has no working backend yet.
 * Renders greyed-out with an explicit label so nobody mistakes it for live.
 */
export function UnavailableControl({
  children,
  reason = "Not available yet",
  className,
}: {
  children: ReactNode;
  reason?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={reason}
      data-unavailable="true"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg text-xs font-medium px-3 py-1.5",
        "text-slate-500 bg-white/[0.03] ring-1 ring-white/5 cursor-not-allowed opacity-70",
        className,
      )}
    >
      {children}
      <span className="text-[10px] uppercase tracking-[0.06em] text-slate-600">· {reason}</span>
    </button>
  );
}
