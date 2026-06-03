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
  const [menu, setMenu] = useState(null); // { client, top, left, up }
  const toast = useToast();

  useEffect(() => { if (filterStatus) setStatusFilter(filterStatus); }, [filterStatus]);
  useEffect(() => {
    const close = () => setMenu(null);
    if (menu) {
      document.addEventListener("click", close);
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
      return () => {
        document.removeEventListener("click", close);
        window.removeEventListener("scroll", close, true);
        window.removeEventListener("resize", close);
      };
    }
  }, [menu]);

  const openRowMenu = (e, c) => {
    e.stopPropagation();
    if (menu && menu.client === c) { setMenu(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const up = r.bottom + 230 > window.innerHeight;
    setMenu({ client: c, top: up ? r.top : r.bottom + 4, left: Math.max(8, r.right - 196), up });
  };

  const act = (c, opts) => { setMenu(null); onOpenClient({ ...c, ...opts }); };

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
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-xs" style={{ padding: "3px 4px" }} onClick={(e) => openRowMenu(e, c)}>
                        <Icon name="dots" size={14} />
                      </button>
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

      {menu && (
        <div
          className="menu"
          style={{ position: "fixed", top: menu.up ? undefined : menu.top, bottom: menu.up ? (window.innerHeight - menu.top + 4) : undefined, left: menu.left, width: 196, zIndex: 1000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="menu-item" onClick={() => act(menu.client, { __tab: "analytics" })}><Icon name="eye" size={12} />View dashboard</div>
          <div className="menu-item" onClick={() => act(menu.client, { __tab: "profile" })}><Icon name="edit" size={12} />Edit account</div>
          <div className="menu-item" onClick={() => act(menu.client, { __tab: "agents" })}><Icon name="config" size={12} />Manage agents</div>
          <div className="menu-item" onClick={() => act(menu.client, { __tab: "financials" })}><Icon name="invoice" size={12} />Billing & invoices</div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => act(menu.client, { __tab: "profile", __action: "suspend" })}><Icon name="bell" size={12} />Suspend</div>
          <div className="menu-item danger" onClick={() => act(menu.client, { __tab: "profile", __action: "block" })}><Icon name="block" size={12} />Block account</div>
          <div className="menu-item danger" onClick={() => act(menu.client, { __tab: "profile", __action: "delete" })}><Icon name="x" size={12} />Delete account</div>
        </div>
      )}
    </>
  );
};

/* ============================================================
   CLIENT DETAIL DRAWER (5 tabs)
   ============================================================ */

const ClientDrawer = ({ client, onClose, onConfigureAgent }) => {
  const [tab, setTab] = useState(client && client.__tab ? client.__tab : "profile");
  const [notes, setNotes] = useState("VIP — quarterly business review scheduled.\nContact prefers async communication via email.");
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const cid = client ? (client.workspaceId || client.id) : null;
  const [edit, setEdit] = useState({ company: "", contact: "", email: "", plan: "Growth", status: "Active", mrr: 0 });
  const [savingClient, setSavingClient] = useState(false);
  const [pw, setPw] = useState(null);
  const [agentList, setAgentList] = useState([]);
  const [agentModal, setAgentModal] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", type: "voice", description: "" });
  const [busyAgent, setBusyAgent] = useState(false);
  const [twAn, setTwAn] = useState(null);
  const [twAnLoading, setTwAnLoading] = useState(false);
  const [cRange, setCRange] = useState("total");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");

  const loadAgents = () =>
    fetch(`/api/admin/clients/${cid}/agents`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAgentList(Array.isArray(d) ? d : []))
      .catch(() => setAgentList([]));

  useEffect(() => {
    if (!client) return;
    setEdit({ company: client.company || "", contact: client.contact || "", email: client.email || "", plan: client.plan || "Growth", status: client.status || "Active", mrr: client.mrr || 0 });
    setPw(null);
    if (client.__tab) setTab(client.__tab);
    if (client.__action) setConfirm(client.__action);
    setTwAn(null);
    setCRange("total");
    setCStart("");
    setCEnd("");
    loadAgents();
  }, [cid]);

  useEffect(() => {
    if (tab !== "analytics" || !cid) return;
    if (cRange === "custom" && (!cStart || !cEnd)) return;
    let active = true;
    setTwAnLoading(true);
    const qs = cRange === "custom" ? `range=custom&start=${cStart}&end=${cEnd}` : `range=${cRange}`;
    fetch(`/api/admin/clients/${cid}/twilio?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setTwAn(d || { configured: false }); })
      .catch(() => { if (active) setTwAn({ configured: false }); })
      .finally(() => { if (active) setTwAnLoading(false); });
    return () => { active = false; };
  }, [tab, cRange, cStart, cEnd, cid]);

  const refresh = () => { try { window.location.reload(); } catch (e) {} };

  const saveClient = async () => {
    setSavingClient(true);
    try {
      const r = await fetch(`/api/admin/clients/${cid}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify({ company: edit.company, contact: edit.contact, email: edit.email, plan: edit.plan, status: edit.status.toLowerCase(), mrr_cents: Math.round((Number(edit.mrr) || 0) * 100) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Save failed");
      toast("Client updated", "success");
      setTimeout(refresh, 700);
    } catch (e) { toast(e.message, "error"); } finally { setSavingClient(false); }
  };

  const changeStatus = async (status) => {
    try {
      const r = await fetch(`/api/admin/clients/${cid}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Failed"); }
      toast("Client " + status, status === "active" ? "success" : "warn");
      setTimeout(refresh, 700);
    } catch (e) { toast(e.message, "error"); }
  };

  const removeClient = async () => {
    try {
      const r = await fetch(`/api/admin/clients/${cid}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Failed"); }
      toast("Client deleted", "error");
      setTimeout(refresh, 700);
    } catch (e) { toast(e.message, "error"); }
  };

  const revealPw = async () => {
    try {
      const r = await fetch(`/api/admin/clients/${cid}/password`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Not available");
      setPw(d.password);
    } catch (e) { toast(e.message, "error"); }
  };

  const savePassword = async () => {
    if (!pw || pw.length < 6) { toast("Password must be at least 6 characters", "error"); return; }
    try {
      const r = await fetch(`/api/admin/clients/${cid}/password`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ password: pw }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      toast("Password updated — share it with the client", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const addAgent = async () => {
    if (!newAgent.name.trim()) { toast("Agent name is required", "error"); return; }
    setBusyAgent(true);
    try {
      const r = await fetch(`/api/admin/clients/${cid}/agents`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(newAgent) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      toast("Agent created", "success");
      setAgentModal(false);
      setNewAgent({ name: "", type: "voice", description: "" });
      loadAgents();
    } catch (e) { toast(e.message, "error"); } finally { setBusyAgent(false); }
  };

  const delAgent = async (id) => {
    try {
      const r = await fetch(`/api/admin/agents/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Failed"); }
      toast("Agent removed", "warn");
      loadAgents();
    } catch (e) { toast(e.message, "error"); }
  };

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
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Account details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Company"><input className="input" value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></Field>
                  <Field label="Contact name"><input className="input" value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} /></Field>
                  <Field label="Login email"><input className="input" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
                  <Field label="MRR ($/mo)"><input className="input mono" type="number" value={edit.mrr} onChange={(e) => setEdit({ ...edit, mrr: e.target.value })} /></Field>
                  <Field label="Plan"><select className="input" value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })}>{["Starter", "Growth", "Pro", "Enterprise", "Scale", "Trial"].map((p) => <option key={p}>{p}</option>)}</select></Field>
                  <Field label="Status"><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{["Active", "Trial", "Suspended", "Blocked", "Churned"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={savingClient} onClick={saveClient}>{savingClient ? "Saving…" : "Save changes"}</button>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Client portal password</div>
                <div className="panel-flat" style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input mono" style={{ flex: 1 }} value={pw ?? ""} placeholder="•••••••• — click Reveal to view" onChange={(e) => setPw(e.target.value)} />
                    <button className="btn btn-secondary btn-xs" onClick={revealPw}>Reveal</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => setPw(suggestPassword())}>Generate</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => { if (pw) { navigator.clipboard && navigator.clipboard.writeText(pw); toast("Password copied", "success"); } }}>Copy</button>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={savePassword}>Save password</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Internal notes <span style={{ color: "var(--text-3)", textTransform: "none", letterSpacing: 0 }}>(admin-only)</span></div>
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Account controls</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => changeStatus("active")}>Activate</button>
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
                <div style={{ fontSize: 12.5, color: "var(--text-1)" }}>{agentList.length} {agentList.length === 1 ? "agent" : "agents"} provisioned</div>
                <button className="btn btn-primary btn-sm" onClick={() => setAgentModal(true)}><Icon name="plus" size={12} />Add agent</button>
              </div>
              {agentList.map((a) => (
                <div key={a.id} className="panel-flat" style={{ padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onConfigureAgent && onConfigureAgent(a.id)} title="Open agent configuration">
                    <div style={{ fontSize: 12.5, color: "var(--text-0)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      {a.role || "Voice Agent"} · {a.channels}
                    </div>
                    {a.description && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{a.description}</div>}
                  </div>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase" }}>{a.type}</span>
                  <button className="btn btn-secondary btn-xs" onClick={() => onConfigureAgent && onConfigureAgent(a.id)}>Configure</button>
                  <button className="btn btn-ghost btn-xs danger" title="Remove agent" onClick={() => delAgent(a.id)}><Icon name="x" size={12} /></button>
                </div>
              ))}
              {agentList.length === 0 && <EmptyState icon="config" title="No agents yet" description="Add the client's first agent — it appears in their portal instantly." />}
            </div>
          )}

          {tab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-strong)", borderRadius: 7, padding: 2 }}>
                  {[["total", "Total"], ["today", "Today"], ["week", "7 days"], ["month", "30 days"], ["custom", "Custom"]].map(([k, l]) => (
                    <button key={k} className={"btn btn-xs " + (cRange === k ? "btn-secondary" : "btn-ghost")} style={{ borderColor: cRange === k ? "var(--border-strong)" : "transparent" }} onClick={() => setCRange(k)}>{l}</button>
                  ))}
                </div>
                {cRange === "custom" && (
                  <>
                    <input type="date" className="input" style={{ width: 140 }} value={cStart} onChange={(e) => setCStart(e.target.value)} />
                    <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
                    <input type="date" className="input" style={{ width: 140 }} value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
                  </>
                )}
              </div>

              {twAnLoading && <div className="panel" style={{ padding: 20, textAlign: "center", color: "var(--text-3)" }}>Loading call data…</div>}
              {!twAnLoading && cRange === "custom" && (!cStart || !cEnd) && (
                <div className="panel" style={{ padding: 14, fontSize: 12.5, color: "var(--text-3)" }}>Pick a start and end date.</div>
              )}
              {!twAnLoading && twAn && !twAn.configured && (
                <div className="panel" style={{ padding: 14, fontSize: 12.5, color: "var(--text-2)" }}>
                  <span className="mono" style={{ color: "#f59e0b" }}>No Twilio data for this client yet.</span>{" "}
                  {twAn.agentsTotal ? `${twAn.agentsTotal} agent${twAn.agentsTotal === 1 ? "" : "s"} but none have a Twilio subaccount SID set in Settings.` : "Add an agent first."}
                </div>
              )}
              {!twAnLoading && twAn && twAn.configured && (
                <>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    Aggregated across <span style={{ color: "var(--text-1)" }}>{twAn.agentsLinked}</span> agent{twAn.agentsLinked === 1 ? "" : "s"}
                    {twAn.range !== "total" && twAn.start && twAn.end ? <> · <span className="mono">{twAn.start} → {twAn.end}</span></> : <> · <span className="mono">all-time</span></>}
                    {twAn.error && <span style={{ color: "#fb7185", marginLeft: 8 }}>· {twAn.error}</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    <MiniStat label="Calls" value={String(twAn.kpis.calls)} />
                    <MiniStat label="Completed" value={String(twAn.kpis.completed)} />
                    <MiniStat label="Completion" value={twAn.kpis.completionRate + "%"} />
                    <MiniStat label="Avg duration" value={twAn.kpis.avgDuration} />
                    <MiniStat label="Minutes" value={String(twAn.kpis.minutes)} />
                  </div>
                  <div className="panel-flat" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{twAn.seriesLabel}</div>
                    <AgentBars data={twAn.series} />
                  </div>
                  <div className="panel-flat" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Outcomes</div>
                    <AgentOutcomes data={twAn.outcomes} />
                  </div>
                </>
              )}
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
          onConfirm={() => { const c = confirm; setConfirm(null); if (c === "delete") removeClient(); else changeStatus(c === "block" ? "blocked" : "suspended"); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {agentModal && (
        <div className="drawer-overlay" style={{ zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setAgentModal(false)}>
          <div className="panel" style={{ width: 440, maxWidth: "92vw", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-0)" }}>New agent</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, marginBottom: 14 }}>Provision an agent for {client.company}. It appears in their portal immediately.</div>
            <Field label="Agent name"><input className="input" placeholder="Front desk assistant" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} autoFocus /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <Field label="Type"><select className="input" value={newAgent.type} onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value })}><option value="voice">Voice</option><option value="whatsapp">WhatsApp</option><option value="both">Voice + WhatsApp</option></select></Field>
              <Field label="Role"><input className="input" placeholder="Booking Agent" value={newAgent.role || ""} onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })} /></Field>
            </div>
            <Field label="Description" style={{ marginTop: 10 }}><textarea className="input" rows={2} placeholder="What this agent does…" value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} /></Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setAgentModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busyAgent} onClick={addAgent}>{busyAgent ? "Creating…" : "Create agent"}</button>
            </div>
          </div>
        </div>
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
const pwWordsA = ["Cedar", "Falcon", "Harbor", "Aspen", "Lumen", "Vertex", "Cobalt", "Onyx", "Maple", "Solace", "Nimbus", "Quartz"];
const pwWordsB = ["Otter", "Comet", "Ridge", "Delta", "Pine", "Ember", "Lynx", "Reef", "Sage", "Vale", "Hawk", "Drift"];
const suggestPassword = () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return pick(pwWordsA) + "-" + pick(pwWordsB) + "-" + Math.floor(1000 + Math.random() * 9000);
};

const NewClientPage = () => {
  const [plan, setPlan] = useState("Growth");
  const [cycle, setCycle] = useState("Monthly");
  const [addAgent, setAddAgent] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentType, setAgentType] = useState("Booking");
  const [agentChannel, setAgentChannel] = useState("Voice");
  const [agentSub, setAgentSub] = useState("");
  const [portal, setPortal] = useState(true);
  const [api, setApi] = useState(false);
  const [features, setFeatures] = useState({ Analytics: true, "Knowledge Base": true, Transcripts: true, "Billing View": true, "Team Members": false });
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(suggestPassword());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);
  const toast = useToast();

  const createClient = async (welcome) => {
    setErr("");
    if (!company.trim() || !email.trim() || !password.trim()) {
      setErr("Company, login email and password are required.");
      return;
    }
    setBusy(true);
    try {
      const sel = plans.find((p) => p.id === plan);
      const channelMap = { "Voice": "Voice Call", "WhatsApp": "WhatsApp", "Voice + WhatsApp": "Voice Call,WhatsApp" };
      const r = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          company: company.trim(), contact: contact.trim(), email: email.trim(), password: password,
          plan: plan, status: "active", mrr_cents: sel ? sel.price * 100 : undefined,
          provisionAgent: addAgent && !!agentName.trim(),
          agentName: agentName.trim(),
          agentRole: agentType === "Call Center" ? "Call Center Agent" : agentType + " Agent",
          agentChannels: channelMap[agentChannel] || "Voice Call",
          agentTwilioSubaccountSid: agentSub.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || ("Failed (" + r.status + ")"));
      setCreated({ email: email.trim(), password: password });
      toast(welcome ? "Client created & welcome email sent" : "Client created", "success");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

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
          <Field label="Company name"><input className="input" placeholder="Acme Logistics, Inc." value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
          <Field label="Contact name"><input className="input" placeholder="Jane Doe" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label="Email address"><input className="input" type="email" placeholder="jane@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
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
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Agent name"><input className="input mono" placeholder="acme_agent_01" value={agentName} onChange={(e) => setAgentName(e.target.value)} /></Field>
              <Field label="Type"><select className="input" value={agentType} onChange={(e) => setAgentType(e.target.value)}><option>Call Center</option><option>Sales</option><option>Booking</option><option>Cold Call</option></select></Field>
              <Field label="Channel"><select className="input" value={agentChannel} onChange={(e) => setAgentChannel(e.target.value)}><option>Voice</option><option>WhatsApp</option><option>Voice + WhatsApp</option></select></Field>
            </div>
            <Field label="Twilio subaccount SID (optional — paste this agent's AC… SID for live call analytics)" style={{ marginTop: 12 }}>
              <input className="input mono" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={agentSub} onChange={(e) => setAgentSub(e.target.value)} />
            </Field>
          </>
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
        <Field label="Portal password (share with the client)" style={{ marginTop: 14, maxWidth: 420 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input mono" value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" title="Suggest another" onClick={() => setPassword(suggestPassword())}>↻</button>
            <button type="button" className="btn btn-secondary" title="Copy" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(password); toast("Password copied", "success"); }}>Copy</button>
          </div>
        </Field>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
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

      {created && (
        <div className="panel" style={{ padding: 16, borderColor: "var(--emerald)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--emerald)" }}>Client created ✓</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>They can now sign in to the client portal with these credentials:</div>
          <div style={{ fontFamily: "var(--ff-mono)", fontSize: 13, marginTop: 10, lineHeight: 1.9 }}>
            <div>Email: {created.email}</div>
            <div>Password: {created.password}</div>
          </div>
        </div>
      )}

      {err && <div style={{ color: "#ff8585", fontSize: 12.5, textAlign: "right" }}>{err}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => toast("Draft saved", "success")}>Save as draft</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => createClient(false)}>Create account only</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => createClient(true)}>{busy ? "Creating…" : "Create account & send welcome email"}</button>
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

/* ============================================================
   AGENT CONFIGURATION (renders in the main content area)
   ============================================================ */
const AgentBars = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "8px 0" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div title={d.value + " calls"} style={{ width: "100%", maxWidth: 26, height: Math.round((d.value / max) * 92) + 2, background: "linear-gradient(180deg,#ef4444,#f59e0b)", borderRadius: 4 }} />
          <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

const AgentOutcomes = ({ data }) => {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((o, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4, fontFamily: "var(--ff-mono)" }}>
            <span style={{ color: "var(--text-1)" }}>{o.outcome}</span>
            <span style={{ color: "var(--text-0)" }}>{o.count}</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
            <div style={{ width: (o.count / total * 100) + "%", height: "100%", background: o.color, borderRadius: 3 }} />
          </div>
        </div>
      ))}
      {data.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)" }}>No calls yet.</div>}
    </div>
  );
};

const AgentConfigPage = ({ agentId, onBack }) => {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ name: "", role: "", type: "voice", status: "live", description: "", twilio_subaccount_sid: "" });
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState("");
  const [kbDirty, setKbDirty] = useState(false);
  const [kbSaving, setKbSaving] = useState(false);
  const [tw, setTw] = useState(null);
  const [twLoading, setTwLoading] = useState(true);
  const [twA, setTwA] = useState(null);
  const [twALoading, setTwALoading] = useState(false);
  const [range, setRange] = useState("total");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [bill, setBill] = useState(null);
  const [billA, setBillA] = useState(null);
  const [billLoading, setBillLoading] = useState(true);
  const [billALoading, setBillALoading] = useState(false);
  const [billRange, setBillRange] = useState("total");
  const [billCStart, setBillCStart] = useState("");
  const [billCEnd, setBillCEnd] = useState("");
  const [tok, setTok] = useState(null);
  const [tokA, setTokA] = useState(null);
  const [tokLoading, setTokLoading] = useState(true);
  const [tokALoading, setTokALoading] = useState(false);
  const [ingestKey, setIngestKey] = useState(null);
  const [ingestRevealed, setIngestRevealed] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/agents/${agentId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d && d.id) {
          setAgent(d);
          setForm({ name: d.name || "", role: d.role || "", type: d.type || "voice", status: d.status || "live", description: d.description || "", twilio_subaccount_sid: d.twilio_subaccount_sid || "" });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch(`/api/agents/${agentId}/kb`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) { setKb(d.content || ""); setKbDirty(false); } })
      .catch(() => {});
    setTwLoading(true);
    fetch(`/api/admin/agents/${agentId}/twilio?range=total`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setTw(d || { configured: false }); })
      .catch(() => { if (active) setTw({ configured: false }); })
      .finally(() => { if (active) setTwLoading(false); });
    setBillLoading(true);
    fetch(`/api/admin/agents/${agentId}/billing?range=total`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setBill(d || { configured: false }); })
      .catch(() => { if (active) setBill({ configured: false }); })
      .finally(() => { if (active) setBillLoading(false); });
    setTokLoading(true);
    fetch(`/api/admin/agents/${agentId}/tokens?range=total`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setTok(d || { configured: false }); })
      .catch(() => { if (active) setTok({ configured: false }); })
      .finally(() => { if (active) setTokLoading(false); });
    setIngestKey(null); setIngestRevealed(false);
    return () => { active = false; };
  }, [agentId]);

  useEffect(() => {
    if (tab !== "analytics") return;
    if (range === "custom" && (!cStart || !cEnd)) return;
    let active = true;
    setTokALoading(true);
    const qs = range === "custom" ? `range=custom&start=${cStart}&end=${cEnd}` : `range=${range}`;
    fetch(`/api/admin/agents/${agentId}/tokens?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setTokA(d || { configured: false }); })
      .catch(() => { if (active) setTokA({ configured: false }); })
      .finally(() => { if (active) setTokALoading(false); });
    return () => { active = false; };
  }, [tab, range, cStart, cEnd, agentId]);

  const revealIngestKey = async () => {
    try {
      const r = await fetch(`/api/admin/agents/${agentId}/ingest-key`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      setIngestKey(d.ingestKey);
      setIngestRevealed(true);
    } catch (e) { toast(e.message, "error"); }
  };
  const regenIngestKey = async () => {
    try {
      const r = await fetch(`/api/admin/agents/${agentId}/ingest-key`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed");
      setIngestKey(d.ingestKey);
      setIngestRevealed(true);
      toast("New ingest key generated — update your backend", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  useEffect(() => {
    if (tab !== "billing") return;
    if (billRange === "custom" && (!billCStart || !billCEnd)) return;
    let active = true;
    setBillALoading(true);
    const qs = billRange === "custom" ? `range=custom&start=${billCStart}&end=${billCEnd}` : `range=${billRange}`;
    fetch(`/api/admin/agents/${agentId}/billing?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setBillA(d || { configured: false }); })
      .catch(() => { if (active) setBillA({ configured: false }); })
      .finally(() => { if (active) setBillALoading(false); });
    return () => { active = false; };
  }, [tab, billRange, billCStart, billCEnd, agentId]);

  useEffect(() => {
    if (tab !== "analytics") return;
    if (range === "custom" && (!cStart || !cEnd)) return;
    let active = true;
    setTwALoading(true);
    const qs = range === "custom" ? `range=custom&start=${cStart}&end=${cEnd}` : `range=${range}`;
    fetch(`/api/admin/agents/${agentId}/twilio?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setTwA(d || { configured: false }); })
      .catch(() => { if (active) setTwA({ configured: false }); })
      .finally(() => { if (active) setTwALoading(false); });
    return () => { active = false; };
  }, [tab, range, cStart, cEnd, agentId]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/agents/${agentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Save failed");
      toast("Agent updated", "success");
      setAgent({ ...agent, ...form });
    } catch (e) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const saveKb = async () => {
    setKbSaving(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/kb`, { method: "PUT", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ content: kb }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Save failed");
      setKbDirty(false);
      toast("Knowledge base saved — synced to the client portal", "success");
    } catch (e) { toast(e.message, "error"); } finally { setKbSaving(false); }
  };

  if (loading) return <div className="panel" style={{ padding: 30, textAlign: "center", color: "var(--text-3)" }}>Loading agent…</div>;
  if (!agent) return <EmptyState icon="config" title="Agent not found" description="It may have been removed." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevron-left" size={14} />Back</button>
        <div className="avatar lg">{(agent.name[0] || "A").toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-0)" }}>{agent.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{agent.channels} · {agent.type}</div>
        </div>
        <StatusDot status={agent.status} />
      </div>

      <div className="tabs">
        {[["overview", "Overview"], ["knowledge", "Knowledge Base"], ["analytics", "Analytics"], ["billing", "Billing"], ["commissioner", "Commissioner"], ["settings", "Settings"]].map(([k, l]) => (
          <div key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tw && tw.configured && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <MiniStat label="Total calls" value={String(tw.kpis.calls)} />
                <MiniStat label="Completed" value={String(tw.kpis.completed)} />
                <MiniStat label="Completion" value={tw.kpis.completionRate + "%"} />
                <MiniStat label="Avg duration" value={tw.kpis.avgDuration} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
                <div className="panel" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{tw.seriesLabel || "Calls by day"}</div>
                  <AgentBars data={tw.series} />
                </div>
                <div className="panel" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Call outcomes</div>
                  <AgentOutcomes data={tw.outcomes} />
                </div>
              </div>
            </>
          )}
          {tw && !tw.configured && (
            <div className="panel" style={{ padding: 14, fontSize: 12.5, color: "var(--text-2)" }}>
              <span className="mono" style={{ color: "#f59e0b" }}>Twilio not connected for this agent.</span> Add its subaccount SID in <b>Settings</b> (and set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in Vercel).
            </div>
          )}
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)", marginBottom: 8 }}>About this agent</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{agent.description || "No description yet — add one in Settings."}</div>
            <div style={{ marginTop: 14 }}>
              <DataRow label="Role / persona" value={agent.role || "—"} />
              <DataRow label="Type" value={agent.type} />
              <DataRow label="Channels" value={agent.channels} />
              <DataRow label="Status" value={agent.status} />
              <DataRow label="Twilio subaccount" value={agent.twilio_subaccount_sid || "—"} />
            </div>
          </div>

          {/* Billing summary */}
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>Billing summary</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Rate <span className="mono">{bill?.rate?.currency || "Rs."} {(bill?.rate?.perMinute ?? 3).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> / billable minute · per-call rounded up</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setTab("billing")}>Open billing →</button>
            </div>
            {billLoading && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Loading billing…</div>}
            {!billLoading && bill && !bill.configured && (
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Add a Twilio subaccount SID in Settings to see billing.</div>
            )}
            {!billLoading && bill && bill.configured && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <MiniStat label="Total cost" value={(bill.rate.currency + " ") + (bill.kpis.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <MiniStat label="Billable minutes" value={String(bill.kpis.billableMinutes)} />
                <MiniStat label="Billable calls" value={String(bill.kpis.billableCalls)} />
                <MiniStat label="Avg / call" value={(bill.rate.currency + " ") + (bill.kpis.avgCallCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
              </div>
            )}
          </div>

          {/* AI token usage summary (Anthropic / Claude) */}
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>AI token usage <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 11.5 }}>· Anthropic / Claude</span></div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>All-time tokens consumed by this agent (posted by your backend after each Claude call)</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setTab("analytics")}>Open analytics →</button>
            </div>
            {tokLoading && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Loading token usage…</div>}
            {!tokLoading && tok && (tok.kpis?.records ?? 0) === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                No token usage recorded yet. Hook up your backend to <span className="mono">POST /api/agents/{agent.id}/usage</span> — there's a sample in <b>Settings → Ingest API key</b>.
              </div>
            )}
            {!tokLoading && tok && tok.kpis && tok.kpis.records > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  <MiniStat label="Total tokens" value={(tok.kpis.totalTokens || 0).toLocaleString()} />
                  <MiniStat label="Input" value={(tok.kpis.inputTokens || 0).toLocaleString()} />
                  <MiniStat label="Output" value={(tok.kpis.outputTokens || 0).toLocaleString()} />
                  <MiniStat label="Total cost" value={"$ " + (tok.kpis.costUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} />
                </div>
                {tok.byModel && tok.byModel.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--text-3)" }}>
                    Top models: {tok.byModel.slice(0, 3).map((m) => `${m.model} (${m.calls} calls · $${m.costUsd.toFixed(4)})`).join(" · ")}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === "knowledge" && (
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>Knowledge base</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Same KB the client edits in their portal — changes sync both ways.</div>
            </div>
            <button className="btn btn-primary btn-sm" disabled={kbSaving || !kbDirty} onClick={saveKb}>{kbSaving ? "Saving…" : "Save"}</button>
          </div>
          <textarea className="input mono" rows={16} value={kb} onChange={(e) => { setKb(e.target.value); setKbDirty(true); }} placeholder="Write what this agent should know — pricing, policies, FAQs… Markdown supported." style={{ width: "100%", resize: "vertical", lineHeight: 1.6 }} />
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, fontFamily: "var(--ff-mono)" }}>{kb.length.toLocaleString()} characters{kbDirty ? " · unsaved" : ""}</div>
        </div>
      )}

      {tab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-strong)", borderRadius: 7, padding: 2 }}>
              {[["total", "Total"], ["today", "Today"], ["week", "7 days"], ["month", "30 days"], ["custom", "Custom"]].map(([k, l]) => (
                <button key={k} className={"btn btn-xs " + (range === k ? "btn-secondary" : "btn-ghost")} style={{ borderColor: range === k ? "var(--border-strong)" : "transparent" }} onClick={() => setRange(k)}>{l}</button>
              ))}
            </div>
            {range === "custom" && (
              <>
                <input type="date" className="input" style={{ width: 150 }} value={cStart} onChange={(e) => setCStart(e.target.value)} />
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>to</span>
                <input type="date" className="input" style={{ width: 150 }} value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
              </>
            )}
          </div>

          {twALoading && <div className="panel" style={{ padding: 20, textAlign: "center", color: "var(--text-3)" }}>Loading call data…</div>}
          {!twALoading && range === "custom" && (!cStart || !cEnd) && <div className="panel" style={{ padding: 16, fontSize: 12.5, color: "var(--text-3)" }}>Pick a start and end date.</div>}
          {!twALoading && twA && !twA.configured && (
            <div className="panel" style={{ padding: 16, fontSize: 12.5, color: "var(--text-2)" }}>
              <span className="mono" style={{ color: "#f59e0b" }}>Twilio not connected for this agent.</span> Add its subaccount SID in Settings.
            </div>
          )}
          {!twALoading && twA && twA.configured && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusDot status={twA.error ? "Overdue" : "Active"} />
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{twA.error ? ("Twilio error: " + twA.error) : ((twA.start && twA.end ? (twA.start + " → " + twA.end) : "all-time") + " · subaccount " + (twA.subaccount || "").slice(0, 10) + "…")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <MiniStat label="Calls" value={String(twA.kpis.calls)} />
                <MiniStat label="Completed" value={String(twA.kpis.completed)} />
                <MiniStat label="Completion" value={twA.kpis.completionRate + "%"} />
                <MiniStat label="Minutes" value={String(twA.kpis.minutes)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
                <div className="panel" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{twA.seriesLabel}</div>
                  <AgentBars data={twA.series} />
                </div>
                <div className="panel" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Outcomes</div>
                  <AgentOutcomes data={twA.outcomes} />
                </div>
              </div>
              <div className="panel">
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12.5, fontWeight: 600, color: "var(--text-0)", display: "flex", justifyContent: "space-between" }}>
                  <span>Call log</span><span style={{ color: "var(--text-3)", fontWeight: 400 }}>{twA.calls.length} calls</span>
                </div>
                <div style={{ maxHeight: 460, overflowY: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>Caller</th><th>Direction</th><th>When</th><th>Duration</th><th>Status</th></tr></thead>
                    <tbody>
                      {twA.calls.map((c) => (
                        <tr key={c.id}>
                          <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-mono)" }}>{c.caller}</td>
                          <td style={{ color: "var(--text-2)" }}>{c.direction}</td>
                          <td style={{ color: "var(--text-2)" }}>{c.startedAt}</td>
                          <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)" }}>{c.duration}</td>
                          <td style={{ color: "var(--text-1)" }}>{c.outcome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {twA.calls.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--text-3)" }}>No calls in this period.</div>}
              </div>
            </>
          )}

          {/* AI token analytics (Anthropic) — uses the same range selector */}
          <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>AI token usage</div>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>· Anthropic / Claude · same range as above</span>
          </div>
          {tokALoading && <div className="panel" style={{ padding: 16, textAlign: "center", color: "var(--text-3)" }}>Loading token usage…</div>}
          {!tokALoading && tokA && tokA.kpis && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                <MiniStat label="Records" value={String(tokA.kpis.records)} />
                <MiniStat label="Input tokens" value={(tokA.kpis.inputTokens || 0).toLocaleString()} />
                <MiniStat label="Output tokens" value={(tokA.kpis.outputTokens || 0).toLocaleString()} />
                <MiniStat label="Total tokens" value={(tokA.kpis.totalTokens || 0).toLocaleString()} />
                <MiniStat label="Cost (USD)" value={"$ " + (tokA.kpis.costUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
                <div className="panel" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{tokA.seriesLabel || "Cost by day ($)"}</div>
                  <AgentBars data={tokA.series} />
                </div>
                <div className="panel" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>By model</div>
                  {(tokA.byModel || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>No token usage in this period.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {tokA.byModel.map((m) => (
                        <div key={m.model}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: "var(--ff-mono)", marginBottom: 4 }}>
                            <span style={{ color: "var(--text-1)" }}>{m.model}</span>
                            <span style={{ color: "var(--text-0)" }}>${m.costUsd.toFixed(4)}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{m.calls} calls · {(m.input + m.output).toLocaleString()} tokens</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {tokA.recent && tokA.recent.length > 0 && (
                <div className="panel">
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12.5, fontWeight: 600, color: "var(--text-0)" }}>Recent LLM calls</div>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>When</th><th>Model</th><th style={{ textAlign: "right" }}>Input</th><th style={{ textAlign: "right" }}>Output</th><th style={{ textAlign: "right" }}>Cost</th><th>Call SID</th></tr></thead>
                      <tbody>
                        {tokA.recent.map((r) => (
                          <tr key={r.id}>
                            <td style={{ color: "var(--text-2)" }}>{r.at ? new Date(r.at).toISOString().slice(0, 19).replace("T", " ") : "—"}</td>
                            <td style={{ color: "var(--text-1)", fontFamily: "var(--ff-mono)", fontSize: 11 }}>{r.model}</td>
                            <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)", textAlign: "right" }}>{r.input.toLocaleString()}</td>
                            <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)", textAlign: "right" }}>{r.output.toLocaleString()}</td>
                            <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-mono)", textAlign: "right" }}>${r.costUsd.toFixed(4)}</td>
                            <td style={{ color: "var(--text-3)", fontFamily: "var(--ff-mono)", fontSize: 10.5 }}>{r.twilio_call_sid || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header: range selector + report download */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-strong)", borderRadius: 7, padding: 2 }}>
              {[["total", "Total"], ["today", "Today"], ["week", "7 days"], ["month", "30 days"], ["custom", "Custom"]].map(([k, l]) => (
                <button key={k} className={"btn btn-xs " + (billRange === k ? "btn-secondary" : "btn-ghost")} style={{ borderColor: billRange === k ? "var(--border-strong)" : "transparent" }} onClick={() => setBillRange(k)}>{l}</button>
              ))}
            </div>
            {billRange === "custom" && (
              <>
                <input type="date" className="input" style={{ width: 150 }} value={billCStart} onChange={(e) => setBillCStart(e.target.value)} />
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
                <input type="date" className="input" style={{ width: 150 }} value={billCEnd} onChange={(e) => setBillCEnd(e.target.value)} />
              </>
            )}
            <div style={{ flex: 1 }} />
            <a
              className="btn btn-primary btn-sm"
              href={(() => {
                const qs = billRange === "custom" && billCStart && billCEnd ? `range=custom&start=${billCStart}&end=${billCEnd}` : `range=${billRange}`;
                return `/admin/agents/${agentId}/billing-report?${qs}`;
              })()}
              target="_blank"
              rel="noopener"
              style={{ textDecoration: "none" }}
            >
              <Icon name="download" size={12} /> Download PDF
            </a>
          </div>

          {billALoading && <div className="panel" style={{ padding: 20, textAlign: "center", color: "var(--text-3)" }}>Loading billing…</div>}
          {!billALoading && billRange === "custom" && (!billCStart || !billCEnd) && (
            <div className="panel" style={{ padding: 14, fontSize: 12.5, color: "var(--text-3)" }}>Pick a start and end date.</div>
          )}
          {!billALoading && billA && !billA.configured && (
            <div className="panel" style={{ padding: 14, fontSize: 12.5, color: "var(--text-2)" }}>
              <span className="mono" style={{ color: "#f59e0b" }}>Twilio not connected for this agent.</span> Add its subaccount SID in <b>Settings</b>.
            </div>
          )}
          {!billALoading && billA && billA.configured && (
            <>
              {/* Period & rate */}
              <div className="panel" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Period</div>
                    <div className="mono" style={{ fontSize: 13, color: "var(--text-0)", marginTop: 2 }}>
                      {billA.range === "total" ? "All-time" : (billA.start + " → " + billA.end)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rate</div>
                    <div className="mono" style={{ fontSize: 13, color: "var(--text-0)", marginTop: 2 }}>{billA.rate.currency} {billA.rate.perMinute.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / billable minute</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Subaccount</div>
                    <div className="mono" style={{ fontSize: 13, color: "var(--text-0)", marginTop: 2 }}>{(billA.subaccount || "").slice(0, 14)}…</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Billing method</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-1)", marginTop: 2 }}>Per call, rounded up to next minute</div>
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <MiniStat label="Total cost" value={billA.rate.currency + " " + (billA.kpis.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <MiniStat label="Billable minutes" value={String(billA.kpis.billableMinutes)} />
                <MiniStat label="Billable calls" value={String(billA.kpis.billableCalls) + " / " + String(billA.kpis.calls)} />
                <MiniStat label="Avg / billable call" value={billA.rate.currency + " " + (billA.kpis.avgCallCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
              </div>

              {/* Cost trend */}
              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{billA.seriesLabel}</div>
                <AgentBars data={billA.series} />
              </div>

              {/* Line items */}
              <div className="panel">
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-0)" }}>Call-level billing</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-3)", marginLeft: 10 }}>{billA.lineItems.length} line items</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-0)" }}>Total {billA.rate.currency} {(billA.kpis.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ maxHeight: 480, overflowY: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Call SID</th><th>When</th><th>Direction</th><th>Outcome</th><th style={{ textAlign: "right" }}>Duration</th><th style={{ textAlign: "right" }}>Bill. min</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
                    <tbody>
                      {billA.lineItems.map((l, i) => (
                        <tr key={l.id}>
                          <td style={{ color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{i + 1}</td>
                          <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-mono)", fontSize: 11 }}>{l.id}</td>
                          <td style={{ color: "var(--text-2)" }}>{l.startedAt}</td>
                          <td style={{ color: "var(--text-2)" }}>{l.direction}</td>
                          <td style={{ color: "var(--text-1)" }}>{l.outcome}</td>
                          <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)", textAlign: "right" }}>{l.duration}</td>
                          <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-mono)", textAlign: "right" }}>{l.billableMinutes}</td>
                          <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-mono)", textAlign: "right" }}>{billA.rate.currency} {(l.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {billA.lineItems.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--text-3)" }}>No billable calls in this period.</div>}
              </div>

              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                Billing is computed from Twilio call records on subaccount <span className="mono">{billA.subaccount}</span>. Each call's duration is rounded up to the next whole minute, then multiplied by the per-minute rate. Source of truth: Twilio Calls API.
              </div>
            </>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="panel" style={{ padding: 16, maxWidth: 620 }}>
          <Field label="Agent name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Role / persona (e.g. Sales person, Booking agent)" style={{ marginTop: 12 }}><input className="input" value={form.role} placeholder="Sales person" onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Field label="Type"><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="voice">Voice</option><option value="whatsapp">WhatsApp</option><option value="both">Voice + WhatsApp</option></select></Field>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="live">Live</option><option value="paused">Paused</option><option value="draft">Draft</option></select></Field>
          </div>
          <Field label="Description" style={{ marginTop: 12 }}><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Twilio subaccount SID (this agent's call data)" style={{ marginTop: 12 }}>
            <input className="input mono" value={form.twilio_subaccount_sid} placeholder="ACxxxxxxxx…" onChange={(e) => setForm({ ...form, twilio_subaccount_sid: e.target.value })} />
          </Field>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Calls & analytics for this agent are read from this Twilio subaccount.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={saveSettings}>{saving ? "Saving…" : "Save changes"}</button>

          {/* Ingest API key for posting Claude/Anthropic token usage */}
          <div style={{ height: 1, background: "var(--border)", margin: "20px 0 16px" }} />
          <Field label="Token-usage ingest API key (Anthropic / Claude)">
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input mono" readOnly value={ingestRevealed ? (ingestKey || "") : "••••••••••••••••••••••••••••••••••••••••"} style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={revealIngestKey}>Reveal</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!ingestRevealed || !ingestKey} onClick={() => { if (ingestKey) { navigator.clipboard && navigator.clipboard.writeText(ingestKey); toast("Key copied", "success"); } }}>Copy</button>
              <button type="button" className="btn btn-amber btn-sm" onClick={regenIngestKey}>Regenerate</button>
            </div>
          </Field>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Your backend POSTs each Claude API call's usage here. Treat this key as a secret. Regenerating invalidates the old one.</div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Example: POST after each Anthropic call</div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--ff-mono)", fontSize: 11.5, background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, color: "var(--text-1)", lineHeight: 1.55, margin: 0 }}>{`curl -X POST https://client-portal-pi-fawn.vercel.app/api/agents/${agent.id}/usage \\
  -H "x-api-key: ${ingestRevealed && ingestKey ? ingestKey : "<your-ingest-key>"}" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "input_tokens":  1234,
    "output_tokens": 567,
    "cache_creation_tokens": 0,
    "cache_read_tokens": 0,
    "twilio_call_sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "request_id": "msg_xxxxxxxxxxxxxxxxxxxxxx"
  }'`}</pre>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
              <span className="mono">model</span> = the Claude model you called. <span className="mono">input_tokens</span>/<span className="mono">output_tokens</span> come from the Anthropic response's <span className="mono">usage</span> object. <span className="mono">request_id</span> (Anthropic's <span className="mono">id</span>) makes the call idempotent.
            </div>
          </div>
        </div>
      )}

      {tab === "commissioner" && (
        <EmptyState icon="users" title="Commissioner" description="Coming soon." />
      )}
    </div>
  );
};

/* ============================================================
   GLOBAL KNOWLEDGE BASE (every agent's KB — read-only viewer)
   ============================================================ */
const KnowledgeBasePage = () => {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/kb", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setData({ clients: [] }); });
    return () => { active = false; };
  }, []);

  const allAgents = (data?.clients || []).flatMap((c) => c.agents.map((a) => ({ ...a, company: c.company })));
  const current = allAgents.find((a) => a.id === sel) || null;

  if (!data) return <div className="panel" style={{ padding: 30, textAlign: "center", color: "var(--text-3)" }}>Loading knowledge bases…</div>;
  if (!allAgents.length) return <EmptyState icon="config" title="No agents yet" description="Once you add agents to clients, their knowledge bases will appear here." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="panel" style={{ padding: 0 }}>
        {allAgents.map((a) => (
          <div
            key={a.id}
            onClick={() => setSel(sel === a.id ? null : a.id)}
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: sel === a.id ? "rgba(255,255,255,0.03)" : "transparent",
            }}
          >
            <div className="avatar">{(a.name[0] || "A").toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text-0)" }}>{a.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{a.company} · {a.role || "Agent"} · {a.type}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{(a.content || "").length.toLocaleString()} ch</span>
            <Icon name={sel === a.id ? "chevron-up" : "chevron-down"} size={14} style={{ color: "var(--text-3)" }} />
          </div>
        ))}
      </div>

      {current && (
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>{current.name} — Knowledge base</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{current.company} · read-only · edit in Agent configuration</div>
            </div>
          </div>
          {current.content ? (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--ff-mono)", fontSize: 12.5, color: "var(--text-1)", background: "rgba(0,0,0,0.25)", padding: 14, borderRadius: 8, maxHeight: 540, overflowY: "auto", margin: 0 }}>{current.content}</pre>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>No knowledge base content yet for this agent.</div>
          )}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { ClientsPage, ClientDrawer, NewClientPage, AgentConfigPage, KnowledgeBasePage });
