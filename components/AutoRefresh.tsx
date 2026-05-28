"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRefreshing(true);
      router.refresh();
      const t = setTimeout(() => setRefreshing(false), 800);
      return () => clearTimeout(t);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={`Auto-refreshing every ${Math.round(intervalMs / 1000)}s`}>
      <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin text-accent-300" : ""}`} />
      Auto
    </span>
  );
}
