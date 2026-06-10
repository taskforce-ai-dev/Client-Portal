"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function DeleteNotificationButton({
  agentId,
  notifId,
}: {
  agentId: string;
  notifId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const onClick = async () => {
    if (!window.confirm("Delete this notification?")) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/agents/${agentId}/notifications?id=${encodeURIComponent(notifId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.message || "Failed");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Delete notification"
      className="text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 rounded-md p-1 transition-colors disabled:opacity-50"
      title="Delete this notification"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );
}
