import SalespeopleManager from "@/components/SalespeopleManager";
import { getSalespeopleSummary } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function SalespeoplePage() {
  const summary = await getSalespeopleSummary();
  return <SalespeopleManager initial={summary} />;
}
