import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";

export const dynamic = "force-dynamic";

export default async function AgentSettingsPage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure how {agent.name} behaves on calls</p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <div className="font-semibold text-white">Identity</div>
          <p className="text-xs text-slate-500 mt-0.5">How the agent introduces itself</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Display name" defaultValue={agent.name} />
          <Field label="Role" defaultValue={agent.role} />
          <Field label="Voice" defaultValue="Nova (warm, female)" />
          <Field label="Language" defaultValue="English (AU)" />
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <div className="font-semibold text-white">Greeting & behaviour</div>
          <p className="text-xs text-slate-500 mt-0.5">Opening line and conversation style</p>
        </div>
        <label className="block">
          <div className="text-xs font-medium text-slate-400 mb-1.5">First message</div>
          <textarea
            rows={3}
            defaultValue="Hi! This is Kavya from Tree House Chalets — thanks for calling. Are you looking to check availability or did you have a question about a stay?"
            className="w-full px-3 py-2 text-sm rounded-xl bg-white/[0.03] border border-white/5 focus:border-accent-400/40 focus:ring-2 focus:ring-accent-400/20 outline-none text-slate-200"
          />
        </label>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <div className="font-semibold text-white">Behaviour</div>
        </div>
        <ToggleRow label="Allow agent to transfer to a human" defaultChecked />
        <ToggleRow label="Record calls" defaultChecked />
        <ToggleRow label="Send call summary by email" defaultChecked />
        <ToggleRow label="Use customer name when known" />
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
      <div className="text-xs font-medium text-slate-400 mb-1.5">{label}</div>
      <input
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-sm rounded-xl bg-white/[0.03] border border-white/5 focus:border-accent-400/40 focus:ring-2 focus:ring-accent-400/20 outline-none text-slate-200"
      />
    </label>
  );
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
      <span className="text-sm text-slate-200">{label}</span>
      <span className="relative inline-flex">
        <input type="checkbox" defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-white/10 peer-checked:bg-gradient-to-r peer-checked:from-accent-400 peer-checked:to-sky-400 transition-colors" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
