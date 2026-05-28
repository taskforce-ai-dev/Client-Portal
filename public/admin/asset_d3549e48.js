/* ============================================================
   FINANCIALS — Payments + Earnings + Overdue
   ============================================================ */

const PaymentsPage = () => {
  const [statusF, setStatusF] = useState("All");
  const [query, setQuery] = useState("");
  const [overdueOpen, setOverdueOpen] = useState(true);
  const toast = useToast();

  const filtered = PAYMENTS.filter((p) =>
    (statusF === "All" || p.status === statusF) &&
    (!query || (p.client + p.id).toLowerCase().includes(query.toLowerCase()))
  );

  const collected = PAYMENTS.filter((p) => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const pending = PAYMENTS.filter((p) => p.status === "Pending").reduce((s, p) => s + p.amount, 0);
  const overdue = PAYMENTS.filter((p) => p.status === "Overdue").reduce((s, p) => s + p.amount, 0);
  const failed = PAYMENTS.filter((p) => p.status === "Failed").reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="Collected this month" value={fmtMoney(collected)} delta="+12.4%" deltaKind="up" />
        <KpiCard label="Pending / due" value={fmtMoney(pending)} subtitle={`${PAYMENTS.filter((p) => p.status === "Pending").length} invoices`} />
        <KpiCard label="Overdue" value={fmtMoney(overdue)} subtitle={`${PAYMENTS.filter((p) => p.status === "Overdue").length} accounts`} tint="rose" />
        <KpiCard label="Failed payments" value={fmtMoney(failed)} subtitle={`${PAYMENTS.filter((p) => p.status === "Failed").length} this period`} tint="rose" />
      </div>

      <div className="panel">
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="searchbar" style={{ width: 260 }}>
            <Icon name="search" size={13} style={{ color: "var(--text-3)" }} />
            <input placeholder="Search payment ID, client…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="input" style={{ width: 130 }} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            {["All", "Paid", "Pending", "Overdue", "Failed", "Refunded"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" style={{ width: 140 }}>
            <option>Last 30 days</option><option>This month</option><option>Last month</option><option>This quarter</option><option>All time</option>
          </select>
          <input className="input mono" placeholder="Min $" style={{ width: 90 }} />
          <input className="input mono" placeholder="Max $" style={{ width: 90 }} />
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => toast("CSV export queued", "success")}><Icon name="download" size={12} />Export</button>
        </div>

        <div style={{ maxHeight: 540, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Client</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Plan</th>
                <th>Method</th>
                <th>Status</th>
                <th style={{ width: 200 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ color: "var(--text-2)" }}>{p.id}</td>
                  <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{p.client}</td>
                  <td style={{ color: "var(--text-2)" }}>{p.date}</td>
                  <td style={{ textAlign: "right", color: "var(--text-0)" }}>${p.amount.toLocaleString()}</td>
                  <td><PlanBadge plan={p.plan} /></td>
                  <td style={{ color: "var(--text-2)" }}>{p.method}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {p.status === "Failed" && <button className="btn btn-amber btn-xs" onClick={() => toast("Retry queued", "warn")}>Retry</button>}
                      {p.status === "Overdue" && <button className="btn btn-amber btn-xs" onClick={() => toast("Reminder sent", "warn")}>Remind</button>}
                      {(p.status === "Pending" || p.status === "Overdue") && <button className="btn btn-secondary btn-xs">Mark paid</button>}
                      {p.status === "Paid" && <button className="btn btn-secondary btn-xs">Refund</button>}
                      <button className="btn btn-ghost btn-xs"><Icon name="invoice" size={11} />View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue panel */}
      <div className="panel">
        <SectionHeader
          title="Overdue accounts"
          subtitle={`${OVERDUE.length} accounts requiring follow-up · ${fmtMoney(overdue)} outstanding`}
          action={
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-amber btn-sm" onClick={() => toast(`Reminders sent to ${OVERDUE.length} accounts`, "warn")}>
                <Icon name="bell" size={12} />Remind all overdue
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOverdueOpen(!overdueOpen)}>
                <Icon name="chevron" size={12} style={{ transform: overdueOpen ? "rotate(90deg)" : "none" }} />
              </button>
            </div>
          }
        />
        {overdueOpen && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Days overdue</th>
                <th>Last contact</th>
                <th style={{ width: 280 }}>Quick actions</th>
              </tr>
            </thead>
            <tbody>
              {OVERDUE.map((o) => (
                <tr key={o.client}>
                  <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{o.client}</td>
                  <td style={{ textAlign: "right", color: "#fda4af" }}>${o.amount.toLocaleString()}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="dot rose pulse" />
                      <span style={{ color: o.days > 30 ? "#fda4af" : "var(--text-1)" }}>{o.days}d</span>
                    </span>
                  </td>
                  <td style={{ color: "var(--text-2)" }}>{o.lastContact}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-amber btn-xs" onClick={() => toast("Reminder sent", "warn")}>Remind</button>
                      <button className="btn btn-danger btn-xs">Block access</button>
                      <button className="btn btn-secondary btn-xs">Write off</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   EARNINGS PAGE
   ============================================================ */

const EarningsPage = () => {
  const [range, setRange] = useState("This year");

  const gross = EARNINGS_MONTHLY.reduce((s, m) => s + m.invoiced, 0);
  const refunds = 8400;
  const net = gross - refunds;
  const collected = EARNINGS_MONTHLY.reduce((s, m) => s + m.collected, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="panel" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>Range:</div>
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-strong)", borderRadius: 7, padding: 2 }}>
          {["This month", "Last month", "Quarter", "This year", "Custom"].map((r) => (
            <button key={r} className={"btn btn-xs " + (range === r ? "btn-secondary" : "btn-ghost")} style={{ borderColor: range === r ? "var(--border-strong)" : "transparent" }} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
        {range === "Custom" && (
          <>
            <input className="input mono" type="date" style={{ width: 140 }} defaultValue="2026-01-01" />
            <input className="input mono" type="date" style={{ width: 140 }} defaultValue="2026-05-23" />
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm"><Icon name="download" size={12} />Export report</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <KpiCard label="Gross revenue" value={fmtAbbrev(gross)} prefix="$" delta="+18.2%" deltaKind="up" />
        <KpiCard label="Net revenue" value={fmtAbbrev(net)} prefix="$" delta="+17.6%" deltaKind="up" subtitle="after refunds" />
        <KpiCard label="Refunds total" value={fmtMoney(refunds)} subtitle="3 refunds issued" tint="rose" />
        <KpiCard label="Avg invoice size" value={fmtMoney(Math.round(gross / 32))} delta="+4.1%" deltaKind="up" />
        <KpiCard label="Collection rate" value="94.7" suffix="%" delta="+1.2pp" deltaKind="up" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "60% minmax(0, 1fr)", gap: 14 }}>
        <div className="panel">
          <SectionHeader title="Revenue by month" subtitle="Invoiced · collected · refunded" />
          <div style={{ padding: "8px 8px 4px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={EARNINGS_MONTHLY} margin={{ top: 8, right: 14, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--ff-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--ff-mono)" }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(239,68,68,0.05)" }} />
                <Bar dataKey="invoiced" name="Invoiced" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Revenue by plan" subtitle="Current MRR contribution" />
          <div style={{ padding: 16 }}>
            {REVENUE_BY_PLAN.map((r) => {
              const max = Math.max(...REVENUE_BY_PLAN.map((x) => x.revenue));
              return (
                <div key={r.plan} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <PlanBadge plan={r.plan} />
                    <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--text-0)" }}>${r.revenue.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: (r.revenue / max * 100) + "%", height: "100%", background: "linear-gradient(90deg, #ef4444, #f87171)", borderRadius: 4, animation: "countup 600ms ease-out both" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="panel">
          <SectionHeader title="Client growth" subtitle="Cumulative active vs churned" />
          <div style={{ padding: "8px 8px 4px" }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={EARNINGS_MONTHLY} margin={{ top: 8, right: 14, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gActive" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gChurn" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--ff-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--ff-mono)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="clients" name="Active clients" stroke="#10b981" strokeWidth={2} fill="url(#gActive)" />
                <Area type="monotone" dataKey="churned" name="Churned" stroke="#f43f5e" strokeWidth={2} fill="url(#gChurn)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="MRR movement" subtitle="This month — net MRR change" />
          <div style={{ padding: 18 }}>
            {MRR_MOVEMENT.map((m, i) => {
              const max = Math.max(...MRR_MOVEMENT.map((x) => Math.abs(x.value)));
              const isPos = m.value > 0;
              return (
                <div key={m.kind} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-1)" }}>{m.kind} MRR</span>
                    <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: isPos ? "#6ee7b7" : "#fda4af" }}>
                      {isPos ? "+" : "−"}${Math.abs(m.value).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: (Math.abs(m.value) / max * 100) + "%", height: "100%", background: m.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ paddingTop: 12, marginTop: 8, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>Net new MRR</span>
              <span style={{ fontFamily: "var(--ff-mono)", fontSize: 18, color: "#6ee7b7" }}>+$5,120</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <SectionHeader title="Monthly breakdown" />
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: "right" }}>Clients</th>
              <th style={{ textAlign: "right" }}>New</th>
              <th style={{ textAlign: "right" }}>Churned</th>
              <th style={{ textAlign: "right" }}>Invoiced</th>
              <th style={{ textAlign: "right" }}>Collected</th>
              <th style={{ textAlign: "right" }}>Outstanding</th>
              <th style={{ textAlign: "right" }}>Net MRR</th>
            </tr>
          </thead>
          <tbody>
            {EARNINGS_MONTHLY.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td style={{ textAlign: "right", color: "var(--text-0)" }}>{m.clients}</td>
                <td style={{ textAlign: "right", color: "#6ee7b7" }}>+{m.newClients}</td>
                <td style={{ textAlign: "right", color: "#fda4af" }}>−{m.churned}</td>
                <td style={{ textAlign: "right" }}>${m.invoiced.toLocaleString()}</td>
                <td style={{ textAlign: "right", color: "var(--text-0)" }}>${m.collected.toLocaleString()}</td>
                <td style={{ textAlign: "right", color: m.outstanding > 1500 ? "#fcd34d" : "var(--text-1)" }}>${m.outstanding.toLocaleString()}</td>
                <td style={{ textAlign: "right", color: "var(--text-0)" }}>${m.netMrr.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

Object.assign(window, { PaymentsPage, EarningsPage });
