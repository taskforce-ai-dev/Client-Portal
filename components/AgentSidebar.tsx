"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CreditCard,
  Hexagon,
  LayoutDashboard,
  Library,
  MessageSquare,
  Phone,
  Settings,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { type Agent } from "@/lib/data";

const mainTop = (id: string) => [
  { href: `/agents/${id}`, label: "Overview", icon: LayoutDashboard, exact: true, key: "overview" as const },
  { href: `/agents/${id}/calls`, label: "Call Logs", icon: Phone, key: "callLog" as const },
  { href: `/agents/${id}/meta-inbox`, label: "Meta Inbox", icon: MessageSquare, key: "metaInbox" as const, requiresChannel: "WhatsApp" as const },
  { href: `/agents/${id}/knowledge`, label: "Knowledge Base", icon: Library, key: "knowledge" as const },
  { href: `/agents/${id}/analytics`, label: "Analytics", icon: BarChart3, key: "analytics" as const },
  { href: `/agents/${id}/conversions`, label: "Conversions", icon: TrendingUp, key: "conversions" as const },
];

const account = (id: string) => [
  { href: `/agents/${id}/billing`, label: "Billing", icon: CreditCard, key: "billing" as const },
  { href: `/agents/${id}/settings`, label: "Settings", icon: Settings, key: "settings" as const },
];

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function AgentSidebar({
  agent,
  minutesUsed,
  minutesLimit,
  quotaStatus,
  quotaPeriodLabel,
  quotaPeriodStart,
  quotaPeriodEnd,
  unreadNotifications,
  allowedFeatures,
}: {
  agent: Agent;
  minutesUsed: number;
  minutesLimit: number;
  quotaStatus: "ok" | "warn" | "exceeded";
  quotaPeriodLabel?: string;
  quotaPeriodStart?: string;
  quotaPeriodEnd?: string;
  /** Set of feature keys the client is allowed to see. Items whose `key`
   *  isn't in this set are hidden from the sidebar. Overview / Settings /
   *  Notifications are never filtered out — they're always shown. */
  allowedFeatures?: Set<string>;
  unreadNotifications: number;
}) {
  const pathname = usePathname();
  const pct = Math.min(999, Math.round((minutesUsed / minutesLimit) * 100));
  const cappedPct = Math.min(100, pct);
  const barClass = quotaStatus === "exceeded"
    ? "bg-gradient-to-r from-rose-500 to-amber-500"
    : quotaStatus === "warn"
      ? "bg-gradient-to-r from-amber-400 to-amber-500"
      : "bg-accent-gradient";

  const Item = ({
    href,
    label,
    Icon,
    exact,
    badge,
  }: {
    href: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badge?: number;
  }) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={clsx(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
          active
            ? "bg-white/[0.06] text-white ring-1 ring-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
        )}
      >
        <Icon className={clsx("w-4 h-4", active ? "text-accent-300" : "text-slate-500")} />
        <span className="flex-1">{label}</span>
        {badge ? (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500/90 text-[10px] font-semibold text-white shadow-[0_0_10px_-2px_rgba(244,63,94,0.7)]">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/5 bg-ink-950/60 backdrop-blur-xl">
      <div className="h-16 flex items-center gap-2.5 px-5">
        <div className="relative w-9 h-9 rounded-xl bg-accent-gradient grid place-items-center shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)]">
          <Hexagon className="w-4 h-4 text-ink-950" strokeWidth={2.5} />
        </div>
        <div className="font-semibold tracking-tight text-white text-[15px]">
          Portal<span className="text-accent-400">.</span>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/select"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All agents
        </Link>
        <div className="mt-2 mx-1 p-3 rounded-xl bg-white/[0.03] ring-1 ring-white/5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agent.gradient} text-white font-bold grid place-items-center text-sm`}
            >
              {agent.initial}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{agent.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{agent.role}</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-1 pb-4 space-y-6 overflow-y-auto">
        <div>
          <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
            Main
          </div>
          <div className="space-y-1">
            {mainTop(agent.id)
              .filter(({ key }) => !allowedFeatures || key === "overview" || allowedFeatures.has(key))
              .filter((item) =>
                "requiresChannel" in item && item.requiresChannel
                  ? agent.channels.includes(item.requiresChannel)
                  : true,
              )
              .map(({ href, label, icon, exact }) => (
                <Item key={href} href={href} label={label} Icon={icon} exact={exact} />
              ))}
            <Item
              href={`/agents/${agent.id}/notifications`}
              label="Notifications"
              Icon={Bell}
              badge={unreadNotifications}
            />
          </div>
        </div>

        <div>
          <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
            Account
          </div>
          <div className="space-y-1">
            {account(agent.id)
              .filter(({ key }) => !allowedFeatures || key === "settings" || allowedFeatures.has(key))
              .map(({ href, label, icon }) => (
                <Item key={href} href={href} label={label} Icon={icon} />
              ))}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400">{quotaPeriodLabel ? `Included · ${quotaPeriodLabel}` : "Included this month"}</span>
          <span className={clsx(
            "font-medium",
            quotaStatus === "exceeded" ? "text-rose-300" : quotaStatus === "warn" ? "text-amber-300" : "text-slate-300",
          )}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className={clsx("h-full rounded-full", barClass)} style={{ width: `${cappedPct}%` }} />
        </div>
        <div className="text-[11px] text-slate-500 mt-2">
          {fmtHm(minutesUsed)} of {fmtHm(minutesLimit)} used
        </div>
        {(quotaPeriodStart && quotaPeriodEnd) && (
          <div className="text-[10px] text-slate-600 mt-1 font-mono" title="Billing period">
            {quotaPeriodStart} → {quotaPeriodEnd}
          </div>
        )}
      </div>
    </aside>
  );
}
