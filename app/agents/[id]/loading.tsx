// Shown while a server component for the agent route segment is fetching.
// Skeleton matches the layout's KPI strip + chart areas so the
// transition feels instant rather than navigating to a blank page.
export default function AgentRouteLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-64 rounded-lg bg-white/[0.04]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="h-3 w-24 rounded bg-white/[0.05] mb-3" />
            <div className="h-7 w-20 rounded bg-white/[0.07] mb-2" />
            <div className="h-3 w-32 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5 h-64">
          <div className="h-3 w-24 rounded bg-white/[0.05] mb-4" />
          <div className="h-full rounded bg-white/[0.02]" />
        </div>
        <div className="card p-5 h-64">
          <div className="h-3 w-24 rounded bg-white/[0.05] mb-4" />
          <div className="h-full rounded bg-white/[0.02]" />
        </div>
      </div>
      <div className="card p-4">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-white/[0.02]" />
          ))}
        </div>
      </div>
    </div>
  );
}
