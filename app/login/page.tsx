"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hexagon, Loader2, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("hello@treehousechalets.com");
  const [password, setPassword] = useState("treehouse2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Sign in failed");
      router.push("/select");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden border-r border-white/5">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(800px 500px at 20% 30%, rgba(34,211,238,0.18), transparent 60%), radial-gradient(700px 500px at 80% 80%, rgba(16,185,129,0.12), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent-gradient grid place-items-center shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)]">
            <Hexagon className="w-4 h-4 text-ink-950" strokeWidth={2.5} />
          </div>
          <div className="font-semibold tracking-tight text-white text-[15px]">
            Portal<span className="text-accent-400">.</span>
          </div>
        </div>

        <div className="relative max-w-md space-y-4">
          <h2 className="text-3xl font-semibold text-white tracking-tight leading-tight">
            One workspace for every AI agent on your team.
          </h2>
          <p className="text-slate-400 text-sm">
            Manage call logs, knowledge bases, analytics and billing across all your
            voice and chat agents — from one dashboard.
          </p>
          <div className="flex gap-2 pt-2">
            <span className="pill-accent">Voice</span>
            <span className="pill-violet">WhatsApp</span>
            <span className="pill-emerald">Live</span>
          </div>
        </div>

        <div className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} TaskforceAI
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-accent-gradient grid place-items-center">
                <Hexagon className="w-4 h-4 text-ink-950" strokeWidth={2.5} />
              </div>
              <div className="font-semibold tracking-tight text-white text-[15px]">
                Portal<span className="text-accent-400">.</span>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Sign in to manage your agents.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <div className="text-xs font-medium text-slate-400 mb-1.5">
                Email
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-dark"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="block">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium text-slate-400">Password</div>
                <a
                  href="#"
                  className="text-xs text-accent-300 hover:text-accent-200"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-dark"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </label>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>Sign in</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="text-xs text-slate-500">
              <span className="text-slate-400 font-medium">Demo account:</span>{" "}
              hello@treehousechalets.com / treehouse2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
