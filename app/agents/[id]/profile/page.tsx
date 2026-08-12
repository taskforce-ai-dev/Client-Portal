import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/clientAuth";
import { getCurrentClientUser } from "@/lib/clientPermissions";
import { findAgentForClient, findClientById } from "@/lib/adminDb";
import ProfileManager from "@/components/ProfileManager";

export const dynamic = "force-dynamic";

// Every signed-in user gets a profile — their account details plus
// self-service name + password changes.
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");

  const me = await getCurrentClientUser();
  if (!me) redirect("/login?msg=disabled");

  // Keep the agent-scoped layout consistent (and verify ownership).
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  const company = (await findClientById(me.client_id))?.company ?? null;
  const isLegacy = session.userId === null;

  const profile = {
    email: me.email,
    name: me.name,
    role: me.is_admin ? (isLegacy ? "Owner" : "Admin") : "Member",
    company,
    memberSince: me.created_at,
    lastLogin: me.last_login_at,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Your account details and sign-in security.</p>
      </div>
      <ProfileManager initial={profile} />
    </div>
  );
}
