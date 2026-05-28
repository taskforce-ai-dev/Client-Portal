/* ============================================================
   CLIENTS — All Clients table + Detail Drawer + New Client form
   ============================================================ */

const ClientsPage = ({ onOpenClient, filterStatus = null }) => {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(filterStatus || "All");
  const [planFilter, setPlanFilter] = useState("All");
  const [countryFilter, setCountryFilter] = useState("All");
  const [sortKey, setSortKey] = useState("mrr");
  const [sortDir, setSortDir] = useState("desc");
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState(new Set());
  const [openMenu, setOpenMenu] = useState(null);
  const toast = useToast();

  useEffect(() => { if (filterStatus) setStatusFilter(filterStatus); }, [filterStatus]);
  useEffect(() => {
    const close = () => setOpenMenu(null);
    if (openMenu) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [openMenu]);

  const filtered = useMemo(() => {
    let list = [...CLIENTS];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((c) => (c.company + c.email + c.id + c.contact).toLowerCase().includes(q));
    }
    if (statusFilter !== "All") list = list.filter((c) => c.status === statusFilter);
    if (planFilter !== "All")   list = list.filter((c) => c.plan === planFilter);
    if (countryFilter !== "All")list = list.filter((c) => c.country === countryFilter);
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [query, statusFilter, planFilter, countryFilter, sortKey, sortDir]);

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const countries = ["All", ...Array.from(new Set(CLIENTS.map((c) => c.country)))];

  return (
    <>
      <div className="panel">
        {/* Controls */}
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="searchbar" style={{ width: 280 }}>
            <Icon name="search" size={13} style={{ color: "var(--text-3)" }} />
            <input placeholder="Search name, email, ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="input" style={{ width: 130 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {["All", "Active", "Trial", "Overdue", "Blocked", "Churned"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" style={{ width: 130 }} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            {["All", "Starter", "Growth", "Pro", "Enterprise"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" style={{ width: 150 }} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            {countries.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" style={{ width: 160 }} value={sortKey + ":" + sortDir} onChange={(e) => { const [k, d] = e.target.value.split(":"); setSortKey(k); setSortDir(d); }}>
            <option value="mrr:desc">MRR (high → low)</option>
            <option value="mrr:asc">MRR (low → high)</option>
            <option value="company:asc">Name (A–Z)</option>
            <option value="joined:desc">Newest first</option>
            <option value="lastActive:asc">Recently active</option>
          </select>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-strong)", borderRadius: 7, padding: 2 }}>
            <button className={"btn btn-xs " + (view === "table" ? "btn-secondary" : "btn-ghost")} onClick={() => setView("table")} style={{ borderColor: view === "table" ? "var(--border-strong)" : "transparent" }}>Table</button>
            <button className={"btn btn-xs " + (view === "cards" ? "btn-secondary" : "btn-ghost")} onClick={() => setView("cards")} style={{ borderColor: view === "cards" ? "var(--border-strong)" : "transparent" }}>Cards</button>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => toast("CSV export queued", "success")}>
            <Icon name="download" size={12} /> Export CSV
          </button>
        </div>

        {/* Table view */}
        {view === "table" && (
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <div className={"checkbox" + (selected.size === filtered.length && filtered.length ? " checked" : "")}
                      onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)))} />
                  </th>
                  <th className="sortable" onClick={() => toggleSort("id")}>Client ID</th>
                  <th className="sortable" onClick={() => toggleSort("company")}>Company</th>
                  <th>Email</th>
                  <th className="sortable" onClick={() => toggleSort("plan")}>Plan</th>
                  <th>Status</th>
                  <th className="sortable" style={{ textAlign: "right" }} onClick={() => toggleSort("mrr")}>MRR</th>
                  <th style={{ textAlign: "right" }}>Agents</th>
                  <th>Last active</th>
                  <th className="sortable" onClick={() => toggleSort("joined")}>Joined</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={selected.has(c.id) ? "selected" : ""}>
                    <td onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                      <div className={"checkbox" + (selected.has(c.id) ? " checked" : "")} />
                    </td>
                    <td className="copyable" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.id); toast("Client ID copied", "success"); }}
                        title="Click to copy"
                        style={{ color: "var(--text-2)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {c.id} <Icon name="copy" size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </td>
                    <td onClick={() => onOpenClient(c)} style={{ cursor: "pointer", color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{c.company}</td>
                    <td style={{ color: "var(--text-2)" }}>{c.email}</td>
                    <td><PlanBadge plan={c.plan} /></td>
                    <td><StatusDot status={c.status} /></td>
                    <td style={{ textAlign: "right", color: "var(--text-0)" }}>${c.mrr.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>{c.agents}</td>
                    <td style={{ color: "var(--text-2)" }}>{c.lastActive}</td>
                    <td style={{ color: "var(--text-2)" }}>{c.joined}</td>
                    <td style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-xs" style={{ padding: "3px 4px" }} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === c.id ? null : c.id); }}>
                        <Icon name="dots" size={14} />
                      </button>
                      {openMenu === c.id && (
                        <div className="menu" style={{ position: "absolute", right: 14, top: 30, zIndex: 10 }}>
                          <div className="menu-item" onClick={() => { onOpenClient(c); setOpenMenu(null); }}><Icon name="eye" size={12} />View dashboard</div>
                          <div className="menu-item"><Icon name="edit" size={12} />Edit account</div>
                          <div className="menu-item"><Icon name="mail" size={12} />Send message</div>
                          <div className="menu-item"><Icon name="invoice" size={12} />Send invoice</div>
                          <div className="menu-item"><Icon name="bell" size={12} />Send reminder</div>
                          <div className="menu-divider" />
                          <div className="menu-item">Upgrade plan</div>
                          <div className="menu-item">Downgrade plan</div>
                          <div className="menu-divider" />
                          <div className="menu-item danger"><Icon name="block" size={12} />Block account</div>
                          <div className="menu-item danger">Suspend</div>
                          <div className="menu-item danger"><Icon name="x" size={12} />Delete account</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <EmptyState icon="users" title="No clients match your filters" description="Try clearing or relaxing the filters above." />}
          </div>
        )}

        {/* Card view */}
        {view === "cards" && (
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filtered.map((c) => (
              <div key={c.id} className="panel-flat" style={{ padding: 14, cursor: "pointer" }} onClick={() => onOpenClient(c)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="avatar lg">{c.company.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-0)" }}>{c.company}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{c.id}</div>
                  </div>
                  <PlanBadge plan={c.plan} />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 12, fontFamily: "var(--ff-mono)", fontSize: 11.5 }}>
                  <div>
                    <div style={{ color: "var(--text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>MRR</div>
                    <div style={{ color: "var(--text-0)", fontSize: 13 }}>${c.mrr.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Agents</div>
                    <div style={{ color: "var(--text-0)", fontSize: 13 }}>{c.agents}</div>
                  </div>
                  <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
                    <StatusDot status={c.status} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-xs" style={{ flex: 1 }}>Message</button>
                  <button className="btn btn-secondary btn-xs" style={{ flex: 1 }}>Invoice</button>
                  <button className="btn btn-ghost btn-xs" style={{ padding: "3px 6px" }}><Icon name="dots" size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>
          <div>Showing 1–{filtered.length} of {filtered.length} · 25 per page</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn btn-ghost btn-xs" disabled style={{ opacity: 0.4 }}>← Prev</button>
            <span className="kbd">1</span>
            <button className="btn btn-ghost btn-xs" disabled style={{ opacity: 0.4 }}>Next →</button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 30, background: "#14161c", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "8px 8px 8px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-lg)" }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-1)" }}>{selected.size} selected</span>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <button className="btn btn-secondary btn-sm" onClick={() => toast(`Reminder sent to ${selected.size} clients`, "success")}>Send reminder</button>
          <button className="btn btn-secondary btn-sm" onClick={() => toast("Exported", "success")}>Export</button>
          <button className="btn btn-danger btn-sm">Block selected</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}><Icon name="x" size={12} /></button>
        </div>
      )}
    </>
  );
};

/* ============================================================
   CLIENT DETAIL DRAWER (5 tabs)
   ============================================================ */

const ClientDrawer = ({ client, onClose }) => {
  const [tab, setTab] = useState("profile");
  const [notes, setNotes] = useState("VIP — quarterly business review scheduled.\nContact prefers async communication via email.");
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  if (!client) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div className="avatar lg">{client.company.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-0)" }}>{client.company}</span>
                <PlanBadge plan={client.plan} />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)", marginTop: 4 }}>
                {client.id} · {client.email}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 14, fontSize: 11.5, fontFamily: "var(--ff-mono)" }}>
                <span><span style={{ color: "var(--text-3)" }}>MRR </span><span style={{ color: "var(--text-0)" }}>${client.mrr.toLocaleString()}</span></span>
                <span><span style={{ color: "var(--text-3)" }}>Paid </span><span style={{ color: "var(--text-0)" }}>${client.totalPaid.toLocaleString()}</span></span>
                <span><span style={{ color: "var(--text-3)" }}>Agents </span><span style={{ color: "var(--text-0)" }}>{client.agents}</span></span>
                <span><StatusDot status={client.status} /></span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            <button className="btn btn-primary btn-sm"><Icon name="eye" size={12} />Impersonate</button>
            <button className="btn btn-secondary btn-sm"><Icon name="mail" size={12} />Message</button>
            <button className="btn btn-secondary btn-sm"><Icon name="invoice" size={12} />Send invoice</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-danger btn-sm" onClick={() => setConfirm("block")}>Block</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: "0 12px" }}>
          {[
            ["profile", "Profile"],
            ["financials", "Financials"],
            ["agents", "Agents"],
            ["analytics", "Analytics"],
            ["support", "Support"],
          ].map(([k, l]) => (
            <div key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Contact</div>
                <DataRow label="Contact name" value={client.contact} />
                <DataRow label="Email" value={client.email} />
                <DataRow label="Phone" value={client.phone} />
                <DataRow label="Country" value={client.country} />
                <DataRow label="Timezone" value={client.timezone} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Plan limits</div>
                <DataRow label="Plan" value={<PlanBadge plan={client.plan} />} />
                <DataRow label="Agents allowed" value={client.plan === "Enterprise" ? "Unlimited" : client.plan === "Pro" ? "10" : client.plan === "Growth" ? "5" : "2"} />
                <DataRow label="Calls / month" value={client.plan === "Enterprise" ? "Unlimited" : client.plan === "Pro" ? "10,000" : client.plan === "Growth" ? "3,000" : "500"} />
                <DataRow label="Storage" value={client.plan === "Enterprise" ? "1 TB" : client.plan === "Pro" ? "100 GB" : client.plan === "Growth" ? "25 GB" : "5 GB"} />
                <DataRow label="Joined" value={client.joined} />
                <DataRow label="Last login" value={client.lastActive} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Internal notes <span style={{ color: "var(--text-3)", textTransform: "none", letterSpacing: 0 }}>(admin-only)</span></div>
                <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Account controls</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary btn-sm">Activate</button>
                  <button className="btn btn-amber btn-sm" onClick={() => setConfirm("suspend")}>Suspend</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirm("block")}>Block</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirm("delete")}>Delete</button>
                </div>
              </div>
            </div>
          )}

          {tab === "financials" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <MiniStat label="MRR" value={"$" + client.mrr.toLocaleString()} />
                <MiniStat label="Total paid" value={"$" + client.totalPaid.toLocaleString()} />
                <MiniStat label="Outstanding" value={client.status === "Overdue" ? "$1,200" : "$0"} tone={client.status === "Overdue" ? "rose" : null} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Payment method</div>
                <div className="panel-flat" style={{ padding: 12, fontFamily: "var(--ff-mono)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>VISA •••• 4421</span>
                  <span style={{ color: "var(--text-3)" }}>exp 04/28</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recent invoices</div>
                <table className="data-table" style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <thead>
                    <tr><th>Invoice</th><th>Date</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {CLIENT_INVOICES.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.id}</td>
                        <td style={{ color: "var(--text-2)" }}>{inv.date}</td>
                        <td style={{ textAlign: "right", color: "var(--text-0)" }}>${inv.amount.toLocaleString()}</td>
                        <td><StatusBadge status={inv.status} /></td>
                        <td><button className="btn btn-ghost btn-xs" onClick={() => toast("Downloading PDF", "success")}><Icon name="download" size={11} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Manual adjustment</div>
                <div className="panel-flat" style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select className="input" style={{ width: 110 }}><option>Add credit</option><option>Charge</option></select>
                    <input className="input mono" placeholder="$0.00" style={{ width: 110 }} />
                    <input className="input" placeholder="Reason" />
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ width: "100%" }}>Apply adjustment</button>
                </div>
              </div>
            </div>
          )}

          {tab === "agents" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-1)" }}>{client.agents} agents provisioned</div>
                <button className="btn btn-primary btn-sm"><Icon name="plus" size={12} />Add agent</button>
              </div>
              {Array.from({ length: Math.min(client.agents, 5) }, (_, i) => {
                const types = ["Call Center", "Sales", "Booking", "Cold Call"];
                const channels = ["Voice", "WhatsApp", "Voice + WhatsApp"];
                const agentName = `${client.company.split(" ")[0].toLowerCase()}_agent_${String(i + 1).padStart(2, "0")}`;
                return (
                  <div key={i} className="panel-flat" style={{ padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "var(--text-0)", fontFamily: "var(--ff-mono)" }}>{agentName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {types[i % types.length]} · {channels[i % channels.length]}
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--ff-mono)", fontSize: 11.5, textAlign: "right" }}>
                      <div style={{ color: "var(--text-0)" }}>{(820 - i * 140).toLocaleString()} calls</div>
                      <div style={{ color: "var(--text-3)", fontSize: 10.5 }}>${(280 - i * 40).toLocaleString()} this mo.</div>
                    </div>
                    <div className={"toggle " + (i % 4 !== 3 ? "on" : "")} />
                  </div>
                );
              })}
              {client.agents === 0 && <EmptyState icon="config" title="No agents provisioned" description="This account has no active agents." />}
            </div>
          )}

          {tab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <MiniStat label="Calls this month" value="12,442" delta="+18%" />
                <MiniStat label="Cost this month" value={"$" + (client.mrr * 0.4 | 0).toLocaleString()} delta="-3%" />
              </div>
              <div className="panel-flat" style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Cost breakdown</div>
                {[
                  { k: "Voice Agent", v: 2840, c: "var(--red-500)" },
                  { k: "AI Language", v: 1620, c: "#10b981" },
                  { k: "Call routing",v: 880,  c: "#38bdf8" },
                ].map((b) => {
                  const total = 2840 + 1620 + 880;
                  return (
                    <div key={b.k} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: "var(--ff-mono)", marginBottom: 4 }}>
                        <span style={{ color: "var(--text-1)" }}>{b.k}</span>
                        <span style={{ color: "var(--text-0)" }}>${b.v.toLocaleString()}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: (b.v / total * 100) + "%", height: "100%", background: b.c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="panel-flat" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plan usage</div>
                  <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11.5, color: "var(--text-0)" }}>62%</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                  <div style={{ width: "62%", height: "100%", background: "linear-gradient(90deg, #ef4444, #f59e0b)", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, fontFamily: "var(--ff-mono)" }}>6,200 / 10,000 calls used</div>
              </div>
              <div className="panel-flat" style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Conversion trend (6mo)</div>
                <Sparkline data={[12, 15, 14, 18, 22, 24]} width={420} height={48} color="#10b981" />
                <div style={{ fontFamily: "var(--ff-mono)", fontSize: 11.5, color: "var(--text-0)", marginTop: 6 }}>24.1% <span style={{ color: "var(--text-3)" }}>· top agent: {client.company.split(" ")[0].toLowerCase()}_agent_01</span></div>
              </div>
            </div>
          )}

          {tab === "support" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-1)" }}>{TICKETS.filter((t) => t.client === client.company).length || 2} tickets on file</div>
                <button className="btn btn-primary btn-sm"><Icon name="plus" size={12} />Open ticket on behalf</button>
              </div>
              <table className="data-table" style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                <thead><tr><th>Ticket</th><th>Subject</th><th>Status</th><th>Opened</th></tr></thead>
                <tbody>
                  {TICKETS.filter((t) => t.client === client.company).map((t) => (
                    <tr key={t.id}><td>{t.id}</td><td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{t.subject}</td><td><StatusDot status={t.status} /></td><td style={{ color: "var(--text-2)" }}>{t.opened}</td></tr>
                  ))}
                  {!TICKETS.filter((t) => t.client === client.company).length && (
                    <>
                      <tr><td>T-1988</td><td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>Onboarding question — agent provisioning</td><td><StatusDot status="Resolved" /></td><td style={{ color: "var(--text-2)" }}>2026-04-12</td></tr>
                      <tr><td>T-1842</td><td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>API key rotation</td><td><StatusDot status="Closed" /></td><td style={{ color: "var(--text-2)" }}>2026-02-28</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>

      {confirm && (
        <ConfirmDialog
          title={`${confirm[0].toUpperCase() + confirm.slice(1)} ${client.company}?`}
          description={
            confirm === "delete" ? "This permanently removes the account, all agents, transcripts, and billing history. This cannot be undone." :
            confirm === "block"  ? "Blocking immediately revokes portal & API access. Existing agents will stop responding. The client cannot re-enable themselves." :
                                   "Suspension pauses agent activity. The client retains portal access and can request reactivation."
          }
          confirmWord={client.company}
          confirmLabel={confirm === "delete" ? "Delete — irreversible" : confirm === "block" ? "Block account" : "Suspend account"}
          onConfirm={() => { toast(`${client.company} ${confirm}ed`, confirm === "delete" ? "error" : "warn"); setConfirm(null); onClose(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

const DataRow = ({ label, value }) => (
  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12.5 }}>
    <span style={{ color: "var(--text-3)" }}>{label}</span>
    <span style={{ color: "var(--text-0)", fontFamily: "var(--ff-mono)" }}>{value}</span>
  </div>
);

const MiniStat = ({ label, value, delta, tone }) => (
  <div className="panel-flat" style={{ padding: 12, borderColor: tone === "rose" ? "rgba(244,63,94,0.25)" : undefined }}>
    <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontFamily: "var(--ff-mono)", fontSize: 17, marginTop: 4, color: tone === "rose" ? "#fda4af" : "var(--text-0)" }}>{value}</div>
    {delta && <div style={{ fontFamily: "var(--ff-mono)", fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>{delta}</div>}
  </div>
);

/* ============================================================
   NEW CLIENT PAGE
   ============================================================ */
const NewClientPage = () => {
  const [plan, setPlan] = useState("Growth");
  const [cycle, setCycle] = useState("Monthly");
  const [addAgent, setAddAgent] = useState(false);
  const [portal, setPortal] = useState(true);
  const [api, setApi] = useState(false);
  const [features, setFeatures] = useState({ Analytics: true, "Knowledge Base": true, Transcripts: true, "Billing View": true, "Team Members": false });
  const [autoInvoice, setAutoInvoice] = useState(true);
  const toast = useToast();

  const plans = [
    { id: "Starter",    price: 29,   agents: "2",        calls: "500",     storage: "5 GB",   support: "Email",          features: ["Voice agent", "Basic analytics"] },
    { id: "Growth",     price: 149,  agents: "5",        calls: "3,000",   storage: "25 GB",  support: "Email + chat",   features: ["All Starter", "WhatsApp channel", "Knowledge base"] },
    { id: "Pro",        price: 449,  agents: "10",       calls: "10,000",  storage: "100 GB", support: "Priority chat",  features: ["All Growth", "Custom voices", "API access"] },
    { id: "Enterprise", price: 1490, agents: "Unlimited",calls: "Unlimited", storage: "1 TB", support: "Dedicated CSM",  features: ["All Pro", "SLA 99.95%", "SSO + audit log export"] },
  ];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Create new client</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Provision an account on behalf of a new customer.</div>
        </div>
      </div>

      <FormSection title="Account details" subtitle="Primary contact and location.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Company name"><input className="input" placeholder="Acme Logistics, Inc." /></Field>
          <Field label="Contact name"><input className="input" placeholder="Jane Doe" /></Field>
          <Field label="Email address"><input className="input" type="email" placeholder="jane@acme.com" /></Field>
          <Field label="Phone number"><input className="input mono" placeholder="+1 ___-___-____" /></Field>
          <Field label="Country">
            <select className="input">
              <option>United States</option><option>Canada</option><option>United Kingdom</option><option>Germany</option><option>India</option><option>Singapore</option><option>Mexico</option>
            </select>
          </Field>
          <Field label="Timezone"><select className="input"><option>America/Los_Angeles</option><option>America/New_York</option><option>Europe/London</option><option>Asia/Singapore</option></select></Field>
        </div>
      </FormSection>

      <FormSection title="Plan selection" subtitle="Pick a starting tier — can be upgraded any time.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {plans.map((p) => (
            <div key={p.id} className="panel-flat" style={{ padding: 14, cursor: "pointer", borderColor: plan === p.id ? "var(--red-500)" : "var(--border)", boxShadow: plan === p.id ? "0 0 0 3px var(--primary-ring)" : "none", transition: "border-color 100ms" }} onClick={() => setPlan(p.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <PlanBadge plan={p.id} />
                {plan === p.id && <Icon name="check" size={14} style={{ color: "var(--red-400)" }} />}
              </div>
              <div style={{ marginTop: 10, fontFamily: "var(--ff-mono)" }}>
                <span style={{ fontSize: 20, color: "var(--text-0)" }}>${p.price}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>/mo</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-2)", fontFamily: "var(--ff-mono)", lineHeight: 1.8 }}>
                <div>{p.agents} agents</div>
                <div>{p.calls} calls/mo</div>
                <div>{p.storage} storage</div>
                <div style={{ color: "var(--text-3)" }}>{p.support}</div>
              </div>
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10, fontSize: 11, color: "var(--text-2)" }}>
                {p.features.map((f, i) => <div key={i} style={{ marginBottom: 3, display: "flex", gap: 6 }}><Icon name="check" size={11} style={{ color: "var(--emerald)" }} />{f}</div>)}
              </div>
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Initial agent setup" subtitle="Optional — provision a first agent now.">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: addAgent ? 14 : 0 }}>
          <div className={"toggle " + (addAgent ? "on" : "")} onClick={() => setAddAgent(!addAgent)} />
          <span style={{ fontSize: 12.5 }}>Provision a starter agent for this client</span>
        </div>
        {addAgent && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Agent name"><input className="input mono" placeholder="acme_agent_01" /></Field>
            <Field label="Type"><select className="input"><option>Call Center</option><option>Sales</option><option>Booking</option><option>Cold Call</option></select></Field>
            <Field label="Channel"><select className="input"><option>Voice</option><option>WhatsApp</option><option>Voice + WhatsApp</option></select></Field>
          </div>
        )}
      </FormSection>

      <FormSection title="Billing setup">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Billing cycle">
            <div style={{ display: "flex", gap: 6 }}>
              {["Monthly", "Annual"].map((c) => (
                <button key={c} className={"btn btn-sm " + (cycle === c ? "btn-primary" : "btn-secondary")} style={{ flex: 1 }} onClick={() => setCycle(c)}>
                  {c}{c === "Annual" && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.85 }}>−15%</span>}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Invoice due (net)"><select className="input" defaultValue="Net 30"><option>Net 7</option><option>Net 14</option><option>Net 30</option></select></Field>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <div className={"toggle " + (autoInvoice ? "on" : "")} onClick={() => setAutoInvoice(!autoInvoice)} />
          <span style={{ fontSize: 12.5 }}>Send invoice automatically each cycle</span>
        </div>
        <Field label="Notes on invoice" style={{ marginTop: 14 }}>
          <textarea className="input" rows={2} placeholder="Optional — appears on all invoices for this account." />
        </Field>
      </FormSection>

      <FormSection title="Access & permissions">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={"toggle " + (portal ? "on" : "")} onClick={() => setPortal(!portal)} />
          <span style={{ fontSize: 12.5 }}>Client portal access enabled</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <div className={"toggle " + (api ? "on" : "")} onClick={() => setApi(!api)} />
          <span style={{ fontSize: 12.5 }}>API access enabled</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>Allowed features</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {Object.keys(features).map((f) => (
              <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5 }} onClick={() => setFeatures({ ...features, [f]: !features[f] })}>
                <div className={"checkbox" + (features[f] ? " checked" : "")} />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </div>
      </FormSection>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => toast("Draft saved", "success")}>Save as draft</button>
        <button className="btn btn-secondary" onClick={() => toast("Account created", "success")}>Create account only</button>
        <button className="btn btn-primary" onClick={() => toast("Account created & welcome email sent", "success")}>Create account & send welcome email</button>
      </div>
    </div>
  );
};

const FormSection = ({ title, subtitle, children }) => (
  <div className="panel">
    <SectionHeader title={title} subtitle={subtitle} />
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

const Field = ({ label, children, style }) => (
  <div style={style}>
    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    {children}
  </div>
);

Object.assign(window, { ClientsPage, ClientDrawer, NewClientPage });
