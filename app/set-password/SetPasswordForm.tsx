"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

// Client form for /set-password. Separate file for the same reason as
// app/login/LoginForm.tsx — useSearchParams() forces dynamic rendering, so
// isolating it here keeps the parent page a plain Server Component with a
// Suspense host.
export default function SetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search?.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This link is missing its token. Ask your admin to resend the invite.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't set your password");
      setDone(true);
      setTimeout(() => {
        router.push("/login?msg=password_set");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set your password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex mb-6">
            <BrandLogo glow={false} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Set your password
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose a password for your portal account. This link works once.
          </p>
        </div>

        {done ? (
          <div className="text-sm text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-lg px-4 py-3 text-center">
            Password set — taking you to sign in…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <div className="text-xs font-medium text-slate-400 mb-1.5">New password</div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-dark"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </label>

            <label className="block">
              <div className="text-xs font-medium text-slate-400 mb-1.5">Confirm password</div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-dark"
                  placeholder="Retype your password"
                  autoComplete="new-password"
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
              disabled={loading || !token}
              className="btn-primary w-full justify-center disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting password…
                </>
              ) : (
                <>Set password</>
              )}
            </button>

            {!token && (
              <p className="text-xs text-slate-500 text-center">
                This link is missing its token. Ask your admin to resend the invite.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
