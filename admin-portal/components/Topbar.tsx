"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function Topbar({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <header className="h-16 border-b border-white/[0.08] bg-bg-0/60 backdrop-blur-xl flex items-center justify-between px-6 lg:px-8">
      <div className="text-sm text-slate-400">
        Super Admin Console
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent-gradient text-bg-0 font-bold grid place-items-center text-xs">
            {initials}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium leading-none">{email}</div>
            <div className="text-[11px] text-slate-500 mt-1">Administrator</div>
          </div>
        </div>
        <button onClick={logout} className="btn-ghost px-2.5" title="Sign out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
