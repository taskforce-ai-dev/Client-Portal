/* ============================================================
   DASHBOARD page
   ============================================================ */
const { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
        XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = Recharts;

const ACTIVITY_META = {
  payment_received: { label: "Payment received",  cls: "good"    },
  signup:           { label: "New signup",         cls: "good"    },
  payment_failed:   { label: "Payment failed",     cls: "bad"     },
  agent_created:    { label: "Agent created",      cls: "neutral" },
  ticket_opened:    { label: "Ticket opened",      cls: "neutral" },
  account_blocked:  { label: "Account blocked",    cls: "bad"     },
  plan_upgrade:     { label: "Plan upgraded",      cls: "good"    },
};

const ActivityRow = ({ item }) => {
  const meta = ACTIVITY_META[item.action];
  const color = meta.cls === "good" ? "var(--emerald)" : meta.cls === "bad" ? "var(--rose)" : "var(--amber)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, padding: "7px 14px", fontFamily: "var(--ff-mono)", fontSize: 11.5, alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ color: "var(--text-3)" }}>{item.ts}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ color: "var(--text-1)" }}>{meta.label}</span>
        <span style={{ color: "var(--text-3)" }}>·</span>
        <span style={{ color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis" }}>{item.client}</span>
        {item.amount != null && <span style={{ color: "var(--text-0)", marginLeft: "auto" }}>${item.amount.toLocaleString()}</span>}
        {item.detail && <span style={{ color: "var(--text-3)", marginLeft: "auto", fontSize: 10.5 }}>{item.detail}</span>}
      </div>
    </div>
  );
};

const ClientBreakdownChart = () => {
  const total = CLIENT_BREAKDOWN.reduce((s, x) => s + x.count, 0);
  return (
    <div style={{ position: "relative", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={CLIENT_BREAKDOWN} dataKey="count" nameKey="name" innerRadius={62} outerRadius={88} stroke="#0f1116" strokeWidth={2} startAngle={90} endAngle={-270}>
            {CLIENT_BREAKDOWN.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontFamily: "var(--ff-mono)", fontSize: 26, fontWeight: 500 }}>{total}</div>
        <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Clients</div>
      </div>
    </div>
  );
};

const DashboardPage = ({ onOpenClient, onNavigate }) => {
  const activeCount = CLIENTS.filter((c) => c.status === "Active").length;

  // No money is derived here. MRR, ARR, outstanding, avg-per-client and
  // uptime render as "Not available yet" until the billing API publishes
  // them — the console only displays what the API returns.
  const topClients = [...CLIENTS].sort((a, b) => (b.mrr || 0) - (a.mrr || 0)).slice(0, 8);
  const needsAttention = OVERDUE.map((o) => ({ client: o.client, issue: "Overdue", since: `${o.days}d`, amount: o.amount, kind: "overdue" }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <KpiUnavailable label="Monthly Recurring Revenue" />
        <KpiUnavailable label="Annualized Revenue (ARR)" />
        <KpiCard label="Active Clients" value={activeCount} subtitle={`${CLIENTS.length} total`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <KpiUnavailable label="Outstanding / Overdue" tint="rose" />
        <KpiUnavailable label="Avg Revenue Per Client" />
        <KpiUnavailable label="Platform Uptime (30d)" kind="disconnected" hint="Uptime monitoring isn't connected yet." />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "45% 30% minmax(0, 1fr)", gap: 14 }}>
        <div className="panel">
          <SectionHeader title="Revenue trend" subtitle="MRR and collected cash · last 12 months" />
          <DataState
            kind="pending"
            title="Revenue trend not available yet"
            description="MRR and collected cash will be plotted here once the billing API publishes them."
            style={{ minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "center" }}
          />
        </div>

        <div className="panel">
          <SectionHeader title="Client breakdown" subtitle="By account status" />
          <ClientBreakdownChart />
          <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11.5, fontFamily: "var(--ff-mono)" }}>
            {CLIENT_BREAKDOWN.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, background: s.color, borderRadius: 2 }} />
                <span style={{ color: "var(--text-1)" }}>{s.name}</span>
                <span style={{ marginLeft: "auto", color: "var(--text-0)" }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <SectionHeader title="Recent activity" action={<button className="btn btn-ghost btn-xs" onClick={() => onNavigate("audit")}>View all</button>} />
          <div style={{ overflowY: "auto", flex: 1, maxHeight: 260 }}>
            {ACTIVITY_FEED.map((it, i) => <ActivityRow key={i} item={it} />)}
          </div>
        </div>
      </div>

      {/* Two tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="panel">
          <SectionHeader
            title="Top clients"
            subtitle={`${topClients.length} of ${CLIENTS.length} accounts`}
            action={<button className="btn btn-ghost btn-xs" onClick={() => onNavigate("clients")}>All clients <Icon name="chevron" size={10} /></button>}
          />
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Client</th>
                <th>Plan</th>
                <th style={{ textAlign: "right" }}>MRR</th>
                <th style={{ textAlign: "right" }}>Total paid</th>
                <th style={{ textAlign: "right" }}>Agents</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((c) => (
                <tr key={c.id} onClick={() => onOpenClient(c)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5 }}>
                        {c.company.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <span style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{c.company}</span>
                    </div>
                  </td>
                  <td><PlanBadge plan={c.plan} /></td>
                  <td style={{ textAlign: "right", color: "var(--text-0)" }}><Money value={c.mrr} /></td>
                  <td style={{ textAlign: "right" }}><Money value={c.totalPaid} /></td>
                  <td style={{ textAlign: "right" }}>{c.agents}</td>
                  <td><StatusDot status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <SectionHeader title="Needs attention" subtitle={`${needsAttention.length} items require action`} />
          {needsAttention.length === 0 ? (
            <DataState kind="pending" title="Nothing to show yet" description="Overdue and failed payments will appear here once the billing API publishes them." />
          ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Issue</th>
                <th>Since</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ width: 170 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {needsAttention.map((it, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{it.client}</td>
                  <td>
                    <StatusDot status={it.kind === "overdue" ? "Overdue" : it.kind === "failed" ? "Failed" : "Open"} />
                  </td>
                  <td>{it.since}</td>
                  <td style={{ textAlign: "right", color: it.amount ? "var(--text-0)" : "var(--text-3)" }}>
                    {it.amount ? "$" + it.amount.toLocaleString() : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-amber btn-xs">Remind</button>
                      <button className="btn btn-secondary btn-xs">View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DashboardPage });
