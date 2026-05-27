import { CreditCard, Download } from "lucide-react";
import { invoices, workspace } from "@/lib/data";

const statusPill: Record<string, string> = {
  paid: "pill-emerald",
  pending: "pill-amber",
  overdue: "pill-rose",
};

export default function BillingPage() {
  const pct = Math.round((workspace.minutesUsed / workspace.minutesLimit) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Billing</h1>
        <p className="text-sm text-slate-400 mt-1">
          {workspace.plan} plan · billed monthly
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="stat-label">Current period</div>
              <div className="text-xl font-semibold tracking-tight text-white mt-0.5">
                {workspace.minutesUsed.toLocaleString()} minutes
              </div>
              <div className="text-xs text-slate-500 mt-1">
                of {workspace.minutesLimit.toLocaleString()} included this month
              </div>
            </div>
            <div className="pill-accent">{pct}% used</div>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-3 gap-4">
            <Stat label="Rate" value="$0.10 / min" />
            <Stat label="Overage" value="$0.12 / min" />
            <Stat label="Renews" value="Jun 26, 2026" />
          </div>
        </div>

        <div className="card p-5">
          <div className="stat-label">Payment method</div>
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] ring-1 ring-white/5">
            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 grid place-items-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Visa •••• 4242</div>
              <div className="text-xs text-slate-500">Expires 09 / 2028</div>
            </div>
          </div>
          <button className="btn-ghost w-full justify-center mt-3 text-xs">Update card</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="font-semibold text-white">Invoices</div>
          <button className="btn-ghost text-xs">
            <Download className="w-3.5 h-3.5" /> Download all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
                <th className="py-3 px-4 font-medium">Invoice</th>
                <th className="py-3 px-4 font-medium">Period</th>
                <th className="py-3 px-4 font-medium">Minutes</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Issued</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-medium text-slate-100">{i.id}</td>
                  <td className="py-3 px-4 text-slate-300">{i.period}</td>
                  <td className="py-3 px-4 text-slate-300">{i.minutes.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-200">${i.amount}</td>
                  <td className="py-3 px-4 text-slate-500">{i.issued}</td>
                  <td className="py-3 px-4">
                    <span className={statusPill[i.status]}>{i.status}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-accent-300 hover:text-accent-200 text-xs font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
    </div>
  );
}
