import StatusBadge from "@/components/StatusBadge";
import { invoices } from "@/lib/data";

export default function InvoicesPage() {
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const outstanding = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            ${total.toLocaleString()} total · ${outstanding.toLocaleString()} outstanding
          </p>
        </div>
        <button className="btn-primary">+ New invoice</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4 font-medium">Invoice</th>
                <th className="py-3 px-4 font-medium">Client</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Issued</th>
                <th className="py-3 px-4 font-medium">Due</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium">{i.id}</td>
                  <td className="py-3 px-4 text-slate-700">{i.client}</td>
                  <td className="py-3 px-4">${i.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-500">{i.issued}</td>
                  <td className="py-3 px-4 text-slate-500">{i.due}</td>
                  <td className="py-3 px-4"><StatusBadge status={i.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-brand-600 hover:underline text-xs font-medium">View</button>
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
