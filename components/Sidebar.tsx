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
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-white border-r border-slate-200">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
        <div className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="font-semibold tracking-tight">Client Portal</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <div className="rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white p-4">
          <div className="text-sm font-semibold">Upgrade to Pro</div>
          <p className="text-xs text-brand-100 mt-1">
            Unlock automations, SSO and audit logs.
          </p>
          <button className="mt-3 w-full bg-white/15 hover:bg-white/25 text-white text-xs font-medium py-1.5 rounded-md">
            Learn more
          </button>
        </div>
      </div>
    </aside>
  );
}
