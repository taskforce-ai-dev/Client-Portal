"use client";

import { useEffect } from "react";

// Records a "last-read at" cookie via POST so the sidebar Bell badge
// resets to 0 on the NEXT navigation (when the server layout re-reads
// the cookie). Runs once per agent per mount.
export default function MarkNotificationsRead({ agentId }: { agentId: string }) {
  useEffect(() => {
    fetch(`/api/agents/${agentId}/notifications/mark-read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [agentId]);
  return null;
}
