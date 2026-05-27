"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  MessageSquare,
  Settings,
  CreditCard,
  Hexagon,
} from "lucide-react";
import clsx from "clsx";

const main = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

const account = [
  { href: "/invoices", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const Item = ({
    href,
    label,
    Icon,
  }: {
    href: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
        <Icon
          className={clsx(
            "w-4 h-4",
            active ? "text-accent-300" : "text-slate-500"
          )}
        />
        {label}
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

      <nav className="flex-1 px-3 pt-2 pb-4 space-y-6 overflow-y-auto">
        <div>
          <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
            Main
          </div>
          <div className="space-y-1">
            {main.map(({ href, label, icon }) => (
              <Item key={href} href={href} label={label} Icon={icon} />
            ))}
          </div>
        </div>

        <div>
          <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
            Account
          </div>
          <div className="space-y-1">
            {account.map(({ href, label, icon }) => (
              <Item key={href} href={href} label={label} Icon={icon} />
            ))}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400">Monthly minutes</span>
          <span className="text-slate-300 font-medium">73%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-accent-gradient" style={{ width: "73%" }} />
        </div>
        <div className="text-[11px] text-slate-500 mt-2">29,200 / 40,000 used</div>
      </div>
    </aside>
  );
}
