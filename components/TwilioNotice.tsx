import { TriangleAlert, Unplug } from "lucide-react";

export default function TwilioNotice({
  configured,
  error,
}: {
  configured: boolean;
  error?: string;
}) {
  if (!configured) {
    return (
      <div className="card p-4 border border-amber-500/20 bg-amber-500/[0.05] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 grid place-items-center shrink-0">
          <Unplug className="w-4 h-4" />
        </div>
        <div className="text-sm">
          <div className="font-medium text-amber-200">Twilio is not connected</div>
          <div className="text-xs text-amber-200/70 mt-0.5">
            Set <code className="font-mono">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="font-mono">TWILIO_AUTH_TOKEN</code> and{" "}
            <code className="font-mono">TWILIO_TREEHOUSE_SUBACCOUNT_SID</code> in your Vercel
            environment to show live call data.
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card p-4 border border-rose-500/20 bg-rose-500/[0.05] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-300 grid place-items-center shrink-0">
          <TriangleAlert className="w-4 h-4" />
        </div>
        <div className="text-sm min-w-0">
          <div className="font-medium text-rose-200">Couldn&apos;t reach Twilio</div>
          <div className="text-xs text-rose-200/70 mt-0.5 font-mono break-all">{error}</div>
        </div>
      </div>
    );
  }
  return null;
}
