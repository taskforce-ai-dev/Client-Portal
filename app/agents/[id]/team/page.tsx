import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/clientAuth";
import { getCurrentClientUser } from "@/lib/clientPermissions";
import { findAgentForClient, findClientById, parseAllowedFeatures } from "@/lib/adminDb";
import { listClientUsers } from "@/lib/clientUsers";
import TeamManager from "@/components/TeamManager";

export const dynamic = "force-dynamic";

// Admin-only: manage the company's portal users (create, set features, disable).
export default async function TeamPage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");

  const me = await getCurrentClientUser();
  if (!me) redirect("/login?msg=disabled");
  if (!me.is_admin) redirect(`/agents/${params.id}`); // non-admins can't manage the team

  // Keep the agent-scoped layout consistent (and verify ownership).
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  const client = await findClientById(session.clientId);
  const companyFeatures = [...parseAllowedFeatures(client?.allowed_features)]; // the toggle-able set
  const users = (await listClientUsers(session.clientId)).map(({ password_hash, ...u }) => {
    void password_hash;
    return u;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Team</h1>
        <p className="text-sm text-slate-400 mt-1">
          Add people from {client?.company ?? "your company"} and choose what each can access. Only admins can manage the team.
        </p>
      </div>
      <TeamManager meId={me.id} companyFeatures={companyFeatures} initialUsers={users} />
    </div>
  );
}
