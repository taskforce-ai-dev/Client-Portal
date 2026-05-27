export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your workspace preferences</p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <div className="font-semibold">Profile</div>
          <p className="text-xs text-slate-500 mt-0.5">Visible to your clients</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" defaultValue="Chrys Fernando" />
          <Field label="Email" defaultValue="chrys@taskforceai.tech" />
          <Field label="Company" defaultValue="TaskforceAI" />
          <Field label="Role" defaultValue="Founder" />
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <div className="font-semibold">Notifications</div>
          <p className="text-xs text-slate-500 mt-0.5">Choose what you want to be pinged about</p>
        </div>
        <ToggleRow label="New client messages" defaultChecked />
        <ToggleRow label="Invoice paid" defaultChecked />
        <ToggleRow label="Project status changes" />
        <ToggleRow label="Weekly digest email" defaultChecked />
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn-ghost">Cancel</button>
        <button className="btn-primary">Save changes</button>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      <input
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
      />
    </label>
  );
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-brand-600" />
    </label>
  );
}
