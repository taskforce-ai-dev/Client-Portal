import { Database, Radio } from "lucide-react";
import type { DataSource } from "@/lib/twilio";

export default function SourceBadge({ source }: { source: DataSource }) {
  if (source === "twilio") {
    return (
      <span className="pill-emerald" title="Live data from Twilio">
        <Radio className="w-3 h-3" />
        Live · Twilio
      </span>
    );
  }
  return (
    <span className="pill-slate" title="Showing demo data. Configure Twilio env vars to see live data.">
      <Database className="w-3 h-3" />
      Demo data
    </span>
  );
}
