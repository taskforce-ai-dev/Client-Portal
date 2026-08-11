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
      <span className="pill-amber" title="Voice provider environment variables are not set.">
        <Unplug className="w-3 h-3" />
        Voice provider not connected
      </span>
    );
  }
  if (error) {
    return (
      <span className="pill-rose" title={error}>
        <TriangleAlert className="w-3 h-3" />
        Voice provider error
      </span>
    );
  }
  return (
    <span className="pill-emerald" title="Live data from the voice provider">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Live · Voice line
    </span>
  );
}
