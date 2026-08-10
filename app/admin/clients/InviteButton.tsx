"use client";

import { useState } from "react";

// Fires POST /api/admin/clients/:id/invite. Same button and endpoint serve
// both "Send invite" (new client, no password set yet) and "Resend invite"
// (admin-triggered reset) — the label is the only thing that changes.
export default function InviteButton({ clientId, label }: { clientId: string; label: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setState("sending");
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/invite`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to send invite");
      setState("sent");
      setMsg(d.emailSent ? "Invite sent" : "Link created (email not configured)");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Failed to send invite");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={onClick}
        disabled={state === "sending"}
        style={{
          fontSize: 12,
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid rgba(34,211,238,.35)",
          background: state === "sending" ? "rgba(34,211,238,.08)" : "rgba(34,211,238,.14)",
          color: "#67e8f9",
          cursor: state === "sending" ? "default" : "pointer",
        }}
      >
        {state === "sending" ? "Sending…" : label}
      </button>
      {msg && (
        <span style={{ fontSize: 11.5, color: state === "error" ? "#fca5a5" : "#94a3b8" }}>{msg}</span>
      )}
    </div>
  );
}
