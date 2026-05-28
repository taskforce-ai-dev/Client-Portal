"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, LineChart, Users } from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/salespeople", label: "Salespeople", icon: Users },
  { href: "/reports", label: "Reports", icon: LineChart },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.08] bg-gradient-to-b from-[#050913] to-[#04070f]">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/[0.08]">
        <div className="w-8 h-8 rounded-lg bg-brand-gradient grid place-items-center">
          <div className="w-3 h-3 rounded-full bg-bg-2" />
        </div>
        <div>
          <div className="font-extrabold tracking-tight leading-none">Sentinel</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">
            Admin Console
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-white/[0.06] text-white ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
              )}
            >
              <Icon className={clsx("w-4 h-4", active ? "text-cyan" : "text-slate-500")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/[0.08]">
        <div className="rounded-xl p-3 ring-1 ring-white/10 bg-white/[0.03]">
          <div className="text-xs font-medium text-slate-200">TaskforceAI</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Super Admin</div>
        </div>
      </div>
    </aside>
  );
}
