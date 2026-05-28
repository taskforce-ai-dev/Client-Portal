import { Radio, TriangleAlert, Unplug } from "lucide-react";

export default function SourceBadge({
  configured,
  error,
}: {
  configured: boolean;
  error?: string;
}) {
  if (!configured) {
    return (
      <span className="pill-amber" title="Twilio environment variables are not set.">
        <Unplug className="w-3 h-3" />
        Twilio not connected
      </span>
    );
  }
  if (error) {
    return (
      <span className="pill-rose" title={error}>
        <TriangleAlert className="w-3 h-3" />
        Twilio error
      </span>
    );
  }
  return (
    <span className="pill-emerald" title="Live data from Twilio">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Live · Twilio
    </span>
  );
}
