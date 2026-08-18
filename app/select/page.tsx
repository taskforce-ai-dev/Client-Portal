import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronDown, Phone, Search } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { getClientSession } from "@/lib/clientAuth";
import { getCurrentClientUser } from "@/lib/clientPermissions";
import { findClientById, listAgentsByClient } from "@/lib/adminDb";
import { callStats, callsToday } from "@/lib/twilio";
import { getAgentCalls } from "@/lib/callSource";

export const dynamic = "force-dynamic";

const channelIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  "Voice Call": Phone,
};

export default async function SelectAgentPage() {
  const session = getClientSession();
  if (!session) redirect("/login");
  const client = await findClientById(session.clientId);
  if (!client) redirect("/login");
  // Mirror the layout-level allow-list — only "active" clients past this point.
  if (client.status !== "active") redirect("/login?msg=disabled");

  const agentRows = await listAgentsByClient(client.id);
  const agents = agentRows.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
    channels: a.channels.split(",").map((c) => c.trim()).filter(Boolean),
    gradient: a.gradient,
    initial: a.initial,
  }));
  const workspace = { name: client.company, logo: client.logo_url };
  const contactUrl = `https://wa.me/94776697566?text=${encodeURIComponent(
    `Hi, I'm from ${workspace.name}. I'd like to request a new agent.`
  )}`;

  // Workspace-level call stats, aggregated across this client's agents from
  // TaskForce Link (agent_call_events).
  const callsResults = await Promise.all(agentRows.map((a) => getAgentCalls(a.id, { max: 200 })));
  const calls = callsResults.flatMap((r) => r.calls);
  const today = callsToday(calls);
  const stats = callStats(today);

  // The signed-in person (distinct from the company/workspace above).
  const me = await getCurrentClientUser();
  const userName = me?.name || me?.email || "";
  const userRole = me?.is_admin ? (session.userId === null ? "Owner" : "Admin") : "Member";
  const userInitials =
    (userName.trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "U").toUpperCase();
  const profileHref = agents[0] ? `/agents/${agents[0].id}/profile` : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl flex items-center justify-between px-6 lg:px-8 gap-4">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <span className="text-slate-700">/</span>
          <button className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.06]">
            {workspace.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-supplied data URL
              <img src={workspace.logo} alt={`${workspace.name} logo`} className="w-9 h-9 rounded-lg object-contain bg-white/[0.04]" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-ink-950 font-bold grid place-items-center text-xs">
                {workspace.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-slate-200">{workspace.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <div className="pill-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_0_rgba(52,211,153,0.8)]" />
            {agents.filter((a) => a.status === "live").length} agent live
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-xl hover:bg-white/[0.06] text-slate-400">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_0_rgba(251,113,133,0.8)]" />
          </button>
          {profileHref ? (
            <Link href={profileHref} title="Your profile" className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white/[0.05] transition">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 font-bold grid place-items-center text-xs ring-1 ring-white/10">
                {userInitials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-sm font-medium text-slate-100 max-w-[150px] truncate">{userName || "Profile"}</div>
                <div className="text-[11px] text-slate-500">{userRole}</div>
              </div>
            </Link>
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 font-bold grid place-items-center text-xs">
              {userInitials}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Select an agent
              </h1>
              <p className="text-sm text-slate-400 mt-1.5">
                {agents.length} {agents.length === 1 ? "agent" : "agents"} provisioned for{" "}
                <span className="text-slate-200 font-medium">{workspace.name}</span>
              </p>
            </div>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input placeholder="Search agents…" className="input-dark" />
            </div>
          </div>

          {agents.length === 0 && (
            <div className="card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-accent-500/15 text-accent-300 grid place-items-center mx-auto mb-4">
                <Phone className="w-5 h-5" />
              </div>
              <div className="text-lg font-semibold text-white">No agents yet</div>
              <div className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
                Your workspace is set up. Agents are provisioned by the TaskforceAI team — reach out and we&apos;ll add your first one.
              </div>
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs inline-flex mt-5"
              >
                Contact us
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="group card p-5 hover:ring-1 hover:ring-accent-500/30 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_24px_60px_-30px_rgba(34,211,238,0.4)] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.gradient} text-white font-bold grid place-items-center text-lg shadow-[0_8px_24px_-8px_rgba(168,85,247,0.5)]`}
                    >
                      {a.initial}
                    </div>
                    <div>
                      <div className="font-semibold text-white leading-tight text-lg">
                        {a.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{a.role}</div>
                    </div>
                  </div>
                  <span className="pill-emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
                    {a.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.channels.map((ch) => {
                    const Icon = channelIcon[ch];
                    return (
                      <span key={ch} className="pill-accent">
                        {Icon && <Icon className="w-3 h-3" />} {ch}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Stat label="Calls today" value={String(today.length)} />
                  <Stat label="Completion" value={`${stats.completionRate}%`} />
                  <Stat label="Avg dur." value={stats.avgDuration} />
                </div>

                <div className="mt-5 pt-4 border-t border-white/5 text-xs text-accent-300 group-hover:text-accent-200 font-medium flex items-center justify-end">
                  Open dashboard →
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 card p-5 flex items-center gap-4 bg-gradient-to-br from-accent-500/[0.06] to-transparent border border-accent-500/15">
            <div className="w-10 h-10 rounded-xl bg-accent-500/15 text-accent-300 grid place-items-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-white">Need another agent?</div>
              <div className="text-xs text-slate-400 mt-0.5">
                New agents are provisioned by the TaskforceAI team. Reach out and we&apos;ll set one up for you.
              </div>
            </div>
            <a
              href={contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
            >
              Contact us
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
}
