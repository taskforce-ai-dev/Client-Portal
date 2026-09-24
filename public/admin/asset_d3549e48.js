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

  // Totals are not summed in the browser. The four headline figures render
  // as "Not available yet" until the billing API publishes them.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiUnavailable label="Collected this month" />
        <KpiUnavailable label="Pending / due" />
        <KpiUnavailable label="Overdue" tint="rose" />
        <KpiUnavailable label="Failed payments" tint="rose" />
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
          {filtered.length === 0 ? (
            <DataState kind="pending" title="Payments not available yet" description="Payment records will be listed here once the billing API publishes them." />
          ) : (
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
          )}
        </div>
      </div>

      {/* Overdue panel */}
      <div className="panel">
        <SectionHeader
          title="Overdue accounts"
          subtitle={`${OVERDUE.length} accounts requiring follow-up`}
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
        {overdueOpen && OVERDUE.length === 0 && (
          <DataState kind="pending" title="Overdue accounts not available yet" description="Overdue balances will be listed here once the billing API publishes them." />
        )}
        {overdueOpen && OVERDUE.length > 0 && (
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

  // Nothing is summed here. Gross / net / refunds / avg invoice /
  // collection rate all come from the billing API or render as
  // "Not available yet".
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
            <input className="input mono" type="date" style={{ width: 140 }} />
            <input className="input mono" type="date" style={{ width: 140 }} />
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm"><Icon name="download" size={12} />Export report</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <KpiUnavailable label="Gross revenue" />
        <KpiUnavailable label="Net revenue" hint="After refunds — published by the billing API." />
        <KpiUnavailable label="Refunds total" tint="rose" />
        <KpiUnavailable label="Avg invoice size" />
        <KpiUnavailable label="Collection rate" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "60% minmax(0, 1fr)", gap: 14 }}>
        <div className="panel">
          <SectionHeader title="Revenue by month" subtitle="Invoiced · collected · refunded" />
          <DataState
            kind="pending"
            title="Monthly revenue not available yet"
            description="Invoiced, collected and refunded amounts will be plotted here once the billing API publishes them."
            style={{ minHeight: 260, display: "flex", flexDirection: "column", justifyContent: "center" }}
          />
        </div>

        <div className="panel">
          <SectionHeader title="Revenue by plan" subtitle="Current MRR contribution" />
          {REVENUE_BY_PLAN.length === 0 && (
            <DataState kind="pending" title="Not available yet" description="Plan-level revenue will come from the billing API." />
          )}
          <div style={{ padding: 16 }}>
            {REVENUE_BY_PLAN.map((r) => {
              const max = Math.max(1, ...REVENUE_BY_PLAN.map((x) => x.revenue || 0));
              return (
                <div key={r.plan} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <PlanBadge plan={r.plan} />
                    <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--text-0)" }}><Money value={r.revenue} /></span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: ((r.revenue || 0) / max * 100) + "%", height: "100%", background: "linear-gradient(90deg, #5b4b8a, #7858a6)", borderRadius: 4, animation: "countup 600ms ease-out both" }} />
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
          <DataState
            kind="pending"
            title="Client growth not available yet"
            description="Active and churned client counts by month will come from the billing API."
            style={{ minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "center" }}
          />
        </div>

        <div className="panel">
          <SectionHeader title="MRR movement" subtitle="This month — net MRR change" />
          <DataState
            kind="pending"
            title="MRR movement not available yet"
            description="New, expansion, contraction and churned MRR will come from the billing API."
            style={{ minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "center" }}
          />
        </div>
      </div>

      <div className="panel">
        <SectionHeader title="Monthly breakdown" />
        <DataState kind="pending" title="Monthly breakdown not available yet" description="Clients, invoiced, collected, outstanding and net MRR by month will come from the billing API." />
      </div>
    </div>
  );
};

Object.assign(window, { PaymentsPage, EarningsPage });
