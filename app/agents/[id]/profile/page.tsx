import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/clientAuth";
import { getCurrentClientUser } from "@/lib/clientPermissions";
import { findAgentForClient, findClientById } from "@/lib/adminDb";
import ProfileManager from "@/components/ProfileManager";
import BusinessDetails from "@/components/BusinessDetails";
import LogoUploader from "@/components/LogoUploader";

export const dynamic = "force-dynamic";

// Profile page. Two distinct things live here:
//  - "Business details" (admins only) — the company's name + logo, shared by
//    everyone in the client.
//  - "My profile" (everyone) — the signed-in person's own name + password.
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");

  const me = await getCurrentClientUser();
  if (!me) redirect("/login?msg=disabled");

  // Keep the agent-scoped layout consistent (and verify ownership).
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  const client = await findClientById(me.client_id);
  const company = client?.company ?? "";
  const isLegacy = session.userId === null;

  const profile = {
    email: me.email,
    name: me.name,
    role: me.is_admin ? (isLegacy ? "Owner" : "Admin") : "Member",
    company: company || null,
    memberSince: me.created_at,
    lastLogin: me.last_login_at,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Profile</h1>
        <p className="text-sm text-slate-400 mt-1">
          {me.is_admin ? "Manage your business details and your own account." : "Your account details and sign-in security."}
        </p>
      </div>

      {/* Business details — admins/owners only. */}
      {me.is_admin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Business details</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your company name and logo — shown across the portal for your whole team.</p>
          </div>
          <BusinessDetails initialCompany={company} />
          <LogoUploader initialLogo={client?.logo_url ?? null} company={company || "your company"} />
        </section>
      )}

      {/* My profile — everyone. */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">My profile</h2>
          <p className="text-xs text-slate-500 mt-0.5">Your personal account name and sign-in security.</p>
        </div>
        <ProfileManager initial={profile} />
      </section>
    </div>
  );
}
