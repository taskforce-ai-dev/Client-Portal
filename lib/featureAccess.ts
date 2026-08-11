import { redirect } from "next/navigation";
import { getClientSession } from "./clientAuth";
import { getCurrentClientUser } from "./clientPermissions";
import { effectiveFeatures } from "./clientUsers";
import { type ClientFeatureKey } from "./adminDb";

// Feature access is resolved for the CURRENT signed-in user, not the company:
// effective features = company plan ∩ the user's own grants. Admins / owners
// (and legacy single-login sessions, which resolve to a synthetic owner) get
// the full company plan. This is the one place both the sidebar and the page
// guards agree on "what can this person see", so a member restricted on the
// Team page is restricted everywhere — nav and direct URL alike.

// Server-side guard for individual client-portal feature pages. Call at the
// top of the page's default export — if the user doesn't have access we
// redirect them to the agent's Overview.
export async function guardClientFeature(featureKey: ClientFeatureKey, agentId: string): Promise<void> {
  const session = getClientSession();
  if (!session) redirect("/login");
  const me = await getCurrentClientUser();
  if (!me) redirect("/login?msg=disabled");
  const allowed = await effectiveFeatures(me);
  if (!allowed.has(featureKey)) redirect(`/agents/${agentId}`);
}

// Non-redirecting variant — returns the effective-features Set so the page can
// fine-tune rendering (e.g. hide "View transcript" buttons inside a table
// without hiding the whole tab). Empty set when signed out or disabled.
export async function getAllowedFeatures(): Promise<Set<ClientFeatureKey>> {
  const me = await getCurrentClientUser();
  if (!me) return new Set();
  return effectiveFeatures(me);
}
