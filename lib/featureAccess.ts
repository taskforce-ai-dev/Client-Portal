import { redirect } from "next/navigation";
import { findClientById, parseAllowedFeatures, type ClientFeatureKey } from "./adminDb";
import { getClientSession } from "./clientAuth";

// Server-side guard for individual client-portal feature pages. Call at
// the top of the page's default export — if the client doesn't have
// access, we redirect them to the agent's Overview. Keeps disabled
// features unreachable by URL even when the sidebar nav item is hidden.
export async function guardClientFeature(featureKey: ClientFeatureKey, agentId: string): Promise<void> {
  const session = getClientSession();
  if (!session) redirect("/login");
  const client = await findClientById(session.clientId);
  if (!client || client.status !== "active") redirect("/login?msg=disabled");
  const allowed = parseAllowedFeatures(client.allowed_features);
  if (!allowed.has(featureKey)) redirect(`/agents/${agentId}`);
}

// Non-redirecting variant — returns the allowed-features Set so the page
// can fine-tune rendering (e.g. hide "View transcript" buttons inside a
// table without hiding the whole tab).
export async function getAllowedFeatures(): Promise<Set<ClientFeatureKey>> {
  const session = getClientSession();
  if (!session) return new Set();
  const client = await findClientById(session.clientId);
  if (!client) return new Set();
  return parseAllowedFeatures(client.allowed_features);
}
