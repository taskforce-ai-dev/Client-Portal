import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Facebook,
  Instagram,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  User,
  UserCheck,
} from "lucide-react";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, listMetaInquiries } from "@/lib/adminDb";
import { guardClientFeature } from "@/lib/featureAccess";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

type Platform = "instagram" | "facebook" | "whatsapp";

type MetaInquiryRow = {
  id: string;
  platform: Platform;
  customer_handle: string;
  occurred_at: string;
  duration_label: string;
  summary: string;
  handover: boolean;
  captured_name: string | null;
  captured_contact: string | null;
  property_interest: string | null;
  outcome: "Handed over" | "In progress" | "Closed";
};

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)} min`;
}

const PLATFORM_LABELS: Record<Platform | "all", string> = {
  all: "All platforms",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

const PLATFORM_ICONS: Record<Platform, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
};

const PLATFORM_BADGE: Record<Platform, string> = {
  instagram: "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20",
  facebook: "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20",
  whatsapp: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20",
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default async function MetaInboxPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { platform?: string; outcome?: string };
}) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");
  await guardClientFeature("metaInbox", params.id);

  const platformFilter = (searchParams.platform || "all") as Platform | "all";
  const outcomeFilter = searchParams.outcome || "all";

  // Pull the last 200 inquiries for this agent. Filtering is done in
  // memory because the dataset stays small and the platform counts above
  // need the unfiltered list anyway.
  const dbRows = await listMetaInquiries(agent.id, { limit: 200 });
  const allRows: MetaInquiryRow[] = dbRows.map((r) => ({
    id: r.id,
    platform: r.platform,
    customer_handle: r.customer_handle || r.captured_name || r.sender_id || "Unknown",
    occurred_at: r.occurred_at,
    duration_label: formatDuration(r.duration_sec),
    summary: r.summary,
    handover: r.handover,
    captured_name: r.captured_name,
    captured_contact: r.captured_contact,
    property_interest: r.property_interest,
    outcome: (r.outcome === "Handed over" || r.outcome === "In progress" || r.outcome === "Closed"
      ? r.outcome
      : r.handover ? "Handed over" : "In progress") as "Handed over" | "In progress" | "Closed",
  }));
  const platformRows = platformFilter === "all" ? allRows : allRows.filter((r) => r.platform === platformFilter);
  const filteredRows =
    outcomeFilter === "all"
      ? platformRows
      : outcomeFilter === "handovers"
        ? platformRows.filter((r) => r.handover)
        : outcomeFilter === "in_progress"
          ? platformRows.filter((r) => !r.handover)
          : platformRows;

  // Stats based on FULTERED-by-platform set (so KPIs reflect the active platform)
  const total = platformRows.length;
  const handoverCount = platformRows.filter((r) => r.handover).length;
  const inProgressCount = platformRows.filter((r) => !r.handover).length;
  const handoverPct = total ? Math.round((handoverCount / total) * 100) : 0;

  // Per-platform counts for the dropdown options
  const platformCounts: Record<Platform | "all", number> = {
    all: allRows.length,
    instagram: allRows.filter((r) => r.platform === "instagram").length,
    facebook: allRows.filter((r) => r.platform === "facebook").length,
    whatsapp: allRows.filter((r) => r.platform === "whatsapp").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Meta Inbox</h1>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 bg-white/[0.04] ring-1 ring-white/5 px-2 py-0.5 rounded-md">
              Instagram · Facebook · WhatsApp
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Conversation summaries from your social DMs, with agent handover details.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AutoRefresh />
          {/* Platform dropdown — native <select> wrapped in a form for SSR navigation. */}
          <form method="GET" className="flex items-center gap-2">
            <label className="stat-label">Platform</label>
            <select
              name="platform"
              defaultValue={platformFilter}
              className="input-dark min-w-[180px]"
            >
              <option value="all">All platforms ({platformCounts.all})</option>
              <option value="instagram">Instagram ({platformCounts.instagram})</option>
              <option value="facebook">Facebook ({platformCounts.facebook})</option>
              <option value="whatsapp">WhatsApp ({platformCounts.whatsapp})</option>
            </select>
            {outcomeFilter !== "all" && <input type="hidden" name="outcome" value={outcomeFilter} />}
            <button type="submit" className="btn-ghost text-xs">Apply</button>
          </form>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Conversations" value={String(total)} hint={PLATFORM_LABELS[platformFilter]} icon={<MessageSquare className="w-4 h-4" />} />
        <Kpi label="Handed over" value={String(handoverCount)} hint={`${handoverPct}% conversion`} tone="emerald" icon={<UserCheck className="w-4 h-4" />} />
        <Kpi label="In progress" value={String(inProgressCount)} hint="Awaiting reply or handover" tone="amber" icon={<MessageCircle className="w-4 h-4" />} />
        <Kpi label="Contacts captured" value={String(platformRows.filter((r) => r.captured_contact).length)} hint="Name + WhatsApp" icon={<User className="w-4 h-4" />} />
      </div>

      {/* Outcome chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="stat-label mr-1">Outcome</span>
        {[
          ["all", "All", total],
          ["handovers", "Handed over", handoverCount],
          ["in_progress", "In progress", inProgressCount],
        ].map(([val, label, count]) => {
          const active = outcomeFilter === val;
          const qs = new URLSearchParams();
          if (platformFilter !== "all") qs.set("platform", platformFilter);
          if (val !== "all") qs.set("outcome", val as string);
          const href = qs.toString() ? `?${qs.toString()}` : "?";
          return (
            <Link
              key={val as string}
              href={href}
              scroll={false}
              className={active
                ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
                : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
              }
            >
              {label}{" "}
              <span className="text-slate-500 ml-0.5">{count as number}</span>
            </Link>
          );
        })}
      </div>

      {/* Conversation table */}
      <div className="card overflow-hidden">
        <InquiryTable rows={filteredRows} />
      </div>

      {/* Footer note */}
      <div className="text-[11px] text-slate-500">
        Conversation summaries are generated by your AI agent at the end of each chat. Handover entries include the customer&apos;s captured name and WhatsApp number for follow-up.
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone?: "emerald" | "amber" | "rose"; icon?: React.ReactNode }) {
  const toneCls = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-white";
  const iconBg = tone === "emerald" ? "bg-emerald-500/10 text-emerald-300"
    : tone === "amber" ? "bg-amber-500/10 text-amber-300"
    : tone === "rose" ? "bg-rose-500/10 text-rose-300"
    : "bg-white/[0.04] text-slate-300";
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="stat-label">{label}</div>
        {icon && <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${iconBg}`}>{icon}</div>}
      </div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function InquiryTable({ rows }: { rows: MetaInquiryRow[] }) {
  if (!rows.length) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] grid place-items-center mx-auto mb-3">
          <MessageSquare className="w-5 h-5 text-slate-500" />
        </div>
        <div className="text-sm text-slate-300 font-medium">No conversations yet.</div>
        <div className="text-xs text-slate-500 mt-1">Inquiries will appear here as soon as the Meta bot starts forwarding summaries.</div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
            <th className="py-3 px-4 font-medium">Platform</th>
            <th className="py-3 px-4 font-medium">Customer</th>
            <th className="py-3 px-4 font-medium">When</th>
            <th className="py-3 px-4 font-medium min-w-[280px]">Summary</th>
            <th className="py-3 px-4 font-medium">Property interest</th>
            <th className="py-3 px-4 font-medium">Contact (on handover)</th>
            <th className="py-3 px-4 font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const Icon = PLATFORM_ICONS[r.platform];
            return (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${PLATFORM_BADGE[r.platform]}`}>
                    <Icon className="w-3 h-3" />
                    {PLATFORM_LABELS[r.platform]}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-slate-200">
                  <div className="font-medium">{r.captured_name || r.customer_handle}</div>
                  {r.captured_name && r.customer_handle !== r.captured_name && (
                    <div className="text-[11px] text-slate-500">{r.customer_handle}</div>
                  )}
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                  <div>{fmtTs(r.occurred_at)}</div>
                  <div className="text-[11px] text-slate-500">{r.duration_label}</div>
                </td>
                <td className="py-3 px-4 text-slate-300 leading-relaxed">{r.summary}</td>
                <td className="py-3 px-4 text-slate-300">
                  {r.property_interest ?? <span className="text-slate-500">—</span>}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {r.handover && r.captured_contact ? (
                    <a
                      href={`https://wa.me/${r.captured_contact.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 text-[12px] font-medium"
                    >
                      <PhoneCall className="w-3 h-3" />
                      {r.captured_contact}
                    </a>
                  ) : (
                    <span className="text-slate-500 text-[12px]">—</span>
                  )}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {r.outcome === "Handed over" ? (
                    <span className="pill-emerald">Handed over</span>
                  ) : r.outcome === "In progress" ? (
                    <span className="pill-amber">In progress</span>
                  ) : (
                    <span className="pill-slate">Closed</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
