/* ============================================================
   SUPPORT — Help Tickets + Send Announcement
   ============================================================ */

const TicketsPage = () => {
  const [statusF, setStatusF] = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [categoryF, setCategoryF] = useState("All");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const filtered = TICKETS.filter((t) =>
    (statusF === "All" || t.status === statusF) &&
    (priorityF === "All" || t.priority === priorityF) &&
    (categoryF === "All" || t.category === categoryF) &&
    (!query || (t.subject + t.client + t.id).toLowerCase().includes(query.toLowerCase()))
  );

  const open = TICKETS.filter((t) => t.status === "Open" || t.status === "In Progress").length;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel">
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="searchbar" style={{ width: 260 }}>
              <Icon name="search" size={13} style={{ color: "var(--text-3)" }} />
              <input placeholder="Search tickets…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input" style={{ width: 140 }} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              {["All", "Open", "In Progress", "Waiting on Client", "Resolved", "Closed"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="input" style={{ width: 110 }} value={priorityF} onChange={(e) => setPriorityF(e.target.value)}>
              {["All", "High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="input" style={{ width: 140 }} value={categoryF} onChange={(e) => setCategoryF(e.target.value)}>
              {["All", "Billing", "Technical", "Account", "Feature Request", "Other"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="input" style={{ width: 140 }}>
              <option>All admins</option><option>Maya R.</option><option>Daniel K.</option><option>Unassigned</option>
            </select>
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm"><Icon name="plus" size={12} />New ticket</button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Client</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Opened</th>
                <th>Assigned</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => setActive(t)} style={{ cursor: "pointer" }} className={active?.id === t.id ? "selected" : ""}>
                  <td>{t.id}</td>
                  <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{t.client}</td>
                  <td style={{ color: "var(--text-1)", fontFamily: "var(--ff-sans)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject}</td>
                  <td>
                    <span style={{ fontSize: 10.5, fontFamily: "var(--ff-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-2)" }}>{t.category}</span>
                  </td>
                  <td>
                    <span style={{ color: t.priority === "High" ? "#fda4af" : t.priority === "Medium" ? "#fcd34d" : "#7dd3fc", fontFamily: "var(--ff-mono)" }}>
                      {t.priority}
                    </span>
                  </td>
                  <td><StatusDot status={t.status} /></td>
                  <td style={{ color: "var(--text-2)" }}>{t.opened}</td>
                  <td style={{ color: "var(--text-1)" }}>{t.assigned}</td>
                  <td style={{ color: "var(--text-2)" }}>{t.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Support analytics */}
        <div className="panel">
          <SectionHeader
            title="Support analytics"
            action={<button className="btn btn-ghost btn-sm" onClick={() => setShowAnalytics(!showAnalytics)}><Icon name="chevron" size={12} style={{ transform: showAnalytics ? "rotate(90deg)" : "none" }} /></button>}
          />
          {showAnalytics && (
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <MiniStat label="Open tickets" value={open} />
                <MiniStat label="Avg resolution time" value="6h 12m" delta="−18% vs last week" />
                <MiniStat label="Tickets this week" value="14" delta="+3 vs last week" />
              </div>
              <div className="panel-flat" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>By category</div>
                {[
                  { k: "Technical",  v: 5, c: "#ef4444" },
                  { k: "Billing",    v: 4, c: "#f59e0b" },
                  { k: "Account",    v: 3, c: "#38bdf8" },
                  { k: "Feature",    v: 2, c: "#10b981" },
                  { k: "Other",      v: 1, c: "#6b7280" },
                ].map((b) => {
                  const total = 15;
                  return (
                    <div key={b.k} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: "var(--ff-mono)", marginBottom: 4 }}>
                        <span style={{ color: "var(--text-1)" }}>{b.k}</span>
                        <span style={{ color: "var(--text-0)" }}>{b.v}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                        <div style={{ width: (b.v / total * 100) + "%", height: "100%", background: b.c, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="panel-flat" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>First-response trend</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                  {[42, 38, 35, 40, 32, 28, 25, 22].map((v, i) => (
                    <div key={i} style={{ flex: 1, background: "linear-gradient(180deg, var(--red-500) 0%, var(--red-700) 100%)", borderRadius: "2px 2px 0 0", height: `${v * 2}%`, opacity: 0.4 + (i / 8) * 0.6 }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--ff-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-3)" }}>Week 1</span>
                  <span style={{ color: "var(--text-0)" }}>22 min avg</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {active && <TicketDrawer ticket={active} onClose={() => setActive(null)} />}
    </>
  );
};

const TicketDrawer = ({ ticket, onClose }) => {
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState("Customer is on Enterprise plan — escalate if not resolved in 2h.");
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const toast = useToast();

  const client = CLIENTS.find((c) => c.company === ticket.client);

  const thread = [
    { who: "client", name: ticket.client, ts: ticket.opened, text: "Hi team — we're noticing our outbound voice agent drops the call right when transferring to a human. Started about 2 hours ago, affecting maybe 1 in 4 transfers. Can you take a look? Logs attached." },
    { who: "admin",  name: "Daniel K.",   ts: ticket.opened + " (+18m)", text: "Thanks for the detail. Looking at the routing logs now. Could you confirm if this is happening on all your inbound numbers, or just the US one?" },
    { who: "client", name: ticket.client, ts: ticket.opened + " (+34m)", text: "Just the US number (+1 415 ***). UK and EU lines are working fine." },
    { who: "admin",  name: "Maya R.",     ts: ticket.opened + " (+1h12m)", text: "Reproduced. Looks like the regional ASR node is intermittently failing on the SIP REFER. Failing over to backup node now — should clear up in the next 10 minutes." },
  ];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" style={{ width: 640 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mono" style={{ color: "var(--text-3)" }}>{ticket.id}</span>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <StatusDot status={status} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-0)" }}>{ticket.subject}</div>

          {/* Client info header */}
          <div style={{ marginTop: 14, padding: 12, background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div className="avatar">{ticket.client.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-0)" }}>{ticket.client}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--ff-mono)", marginTop: 2, display: "flex", gap: 10 }}>
                {client && <><PlanBadge plan={client.plan} /><StatusDot status={client.status} /><span>MRR ${client.mrr.toLocaleString()}</span></>}
              </div>
            </div>
            <button className="btn btn-ghost btn-xs">View client →</button>
          </div>

          {/* Meta controls */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Field label="Category"><select className="input" defaultValue={ticket.category}><option>Billing</option><option>Technical</option><option>Account</option><option>Feature Request</option><option>Other</option></select></Field>
            <Field label="Priority">
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
            </Field>
            <Field label="Assigned to">
              <select className="input" defaultValue={ticket.assigned}>
                <option>—</option><option>Maya R.</option><option>Daniel K.</option><option>Priya N.</option><option>Jordan E.</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Thread */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Conversation</div>
            {thread.map((m, i) => (
              <div key={i} style={{
                marginBottom: 10,
                padding: 12,
                background: m.who === "admin" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)",
                border: "1px solid " + (m.who === "admin" ? "rgba(239,68,68,0.15)" : "var(--border)"),
                borderRadius: 8,
                marginLeft: m.who === "admin" ? 28 : 0,
                marginRight: m.who === "admin" ? 0 : 28,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: m.who === "admin" ? "#fca5a5" : "var(--text-0)" }}>
                    {m.who === "admin" && <span style={{ marginRight: 6, fontSize: 10, padding: "1px 6px", background: "rgba(239,68,68,0.15)", borderRadius: 3, letterSpacing: "0.04em" }}>STAFF</span>}
                    {m.name}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>{m.ts}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>{m.text}</div>
              </div>
            ))}
          </div>

          {/* Internal notes */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Internal notes <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--text-3)" }}>(admins only — never visible to client)</span>
            </div>
            <textarea className="input" rows={3} value={internal} onChange={(e) => setInternal(e.target.value)} style={{ background: "rgba(245,158,11,0.04)", borderColor: "rgba(245,158,11,0.18)" }} />
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <textarea className="input" rows={3} placeholder="Type your reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => { toast("Reply sent", "success"); setReply(""); }}>Send reply</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { toast("Reply sent · ticket closed", "success"); setStatus("Closed"); }}>Send & close</button>
            <div style={{ flex: 1 }} />
            <button className={"btn btn-xs " + (status === "In Progress" ? "btn-primary" : "btn-secondary")} onClick={() => setStatus("In Progress")}>In progress</button>
            <button className={"btn btn-xs " + (status === "Waiting on Client" ? "btn-primary" : "btn-secondary")} onClick={() => setStatus("Waiting on Client")}>Waiting on client</button>
            <button className={"btn btn-xs " + (status === "Resolved" ? "btn-primary" : "btn-secondary")} onClick={() => setStatus("Resolved")}>Resolve</button>
            <button className={"btn btn-xs " + (status === "Closed" ? "btn-primary" : "btn-secondary")} onClick={() => setStatus("Closed")}>Close</button>
          </div>
        </div>
      </aside>
    </>
  );
};

/* ============================================================
   SEND ANNOUNCEMENT PAGE
   ============================================================ */

const AnnouncementPage = () => {
  const [target, setTarget] = useState("All Clients");
  const [planFilter, setPlanFilter] = useState("Enterprise");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [specific, setSpecific] = useState([]);
  const [subject, setSubject] = useState("Scheduled maintenance — Sunday 02:00 UTC");
  const [body, setBody] = useState("Hi {{contact_name}},\n\nWe'll be performing routine maintenance on our voice infrastructure this Sunday, 25 May from 02:00 to 02:30 UTC. During this window you may experience brief interruptions to outbound voice agents.\n\nNo action is required on your part. We'll send a follow-up once maintenance is complete.\n\n— The Sentinel team");
  const [type, setType] = useState("Maintenance Notice");
  const [via, setVia] = useState({ email: true, inApp: true });
  const [schedule, setSchedule] = useState("now");
  const toast = useToast();

  let recipients = CLIENTS.length;
  if (target === "By Plan") recipients = CLIENTS.filter((c) => c.plan === planFilter).length;
  else if (target === "By Status") recipients = CLIENTS.filter((c) => c.status === statusFilter).length;
  else if (target === "Specific Clients") recipients = specific.length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel">
          <SectionHeader title="Audience" />
          <div style={{ padding: 16 }}>
            <Field label="Target">
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option>All Clients</option><option>By Plan</option><option>By Status</option><option>Specific Clients</option>
              </select>
            </Field>
            {target === "By Plan" && (
              <Field label="Plan" style={{ marginTop: 12 }}>
                <select className="input" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                  <option>Starter</option><option>Growth</option><option>Pro</option><option>Enterprise</option>
                </select>
              </Field>
            )}
            {target === "By Status" && (
              <Field label="Status" style={{ marginTop: 12 }}>
                <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option>Active</option><option>Trial</option><option>Overdue</option><option>Blocked</option>
                </select>
              </Field>
            )}
            {target === "Specific Clients" && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>Select clients</div>
                <div className="panel-flat" style={{ padding: 8, maxHeight: 220, overflowY: "auto" }}>
                  {CLIENTS.map((c) => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 5 }} onClick={() => setSpecific(specific.includes(c.id) ? specific.filter((x) => x !== c.id) : [...specific, c.id])}>
                      <div className={"checkbox" + (specific.includes(c.id) ? " checked" : "")} />
                      <span style={{ fontSize: 12.5 }}>{c.company}</span>
                      <PlanBadge plan={c.plan} />
                      <span style={{ marginLeft: "auto", fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--text-3)" }}>{c.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8, fontFamily: "var(--ff-mono)", fontSize: 12 }}>
              <Icon name="users" size={12} style={{ marginRight: 6, verticalAlign: "middle", color: "var(--red-400)" }} />
              Estimated recipients: <span style={{ color: "var(--text-0)" }}>{recipients}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Compose message" />
          <div style={{ padding: 16 }}>
            <Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="Body" style={{ marginTop: 14 }}>
              <textarea className="input" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 6, fontFamily: "var(--ff-mono)" }}>
              Variables: <span style={{ color: "var(--red-300)" }}>{"{{contact_name}}"}</span> · <span style={{ color: "var(--red-300)" }}>{"{{company}}"}</span> · <span style={{ color: "var(--red-300)" }}>{"{{plan}}"}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Delivery options" />
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Type">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option>Announcement</option><option>Maintenance Notice</option><option>Invoice Reminder</option><option>Feature Update</option>
              </select>
            </Field>
            <Field label="Send as">
              <div style={{ display: "flex", gap: 14, paddingTop: 7 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5 }} onClick={() => setVia({ ...via, email: !via.email })}>
                  <div className={"checkbox" + (via.email ? " checked" : "")} /> Email
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5 }} onClick={() => setVia({ ...via, inApp: !via.inApp })}>
                  <div className={"checkbox" + (via.inApp ? " checked" : "")} /> In-app
                </label>
              </div>
            </Field>
            <Field label="Schedule">
              <div style={{ display: "flex", gap: 6 }}>
                <button className={"btn btn-sm " + (schedule === "now" ? "btn-primary" : "btn-secondary")} style={{ flex: 1 }} onClick={() => setSchedule("now")}>Send now</button>
                <button className={"btn btn-sm " + (schedule === "later" ? "btn-primary" : "btn-secondary")} style={{ flex: 1 }} onClick={() => setSchedule("later")}>Schedule</button>
              </div>
            </Field>
            {schedule === "later" && (
              <Field label="When">
                <input className="input mono" type="datetime-local" defaultValue="2026-05-25T09:00" />
              </Field>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => toast(`Announcement sent to ${recipients} recipients`, "success")}>
            {schedule === "now" ? "Send now" : "Schedule send"}
          </button>
          <button className="btn btn-secondary" onClick={() => toast("Draft saved", "success")}>Save draft</button>
          <button className="btn btn-secondary" onClick={() => toast("Test sent to your inbox", "success")}>Preview & test</button>
        </div>
      </div>

      {/* Preview panel */}
      <div style={{ position: "sticky", top: 60, alignSelf: "flex-start", maxHeight: "calc(100vh - 100px)" }}>
        <div className="panel" style={{ overflow: "hidden" }}>
          <SectionHeader title="Preview" subtitle="How it will appear in inbox" />
          <div style={{ padding: 18, background: "#f4f5f7", color: "#1a1c22", borderRadius: "0 0 13px 13px" }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 12, fontFamily: "var(--ff-mono)" }}>
              <div>From: notifications@sentinel.ops</div>
              <div>To: {recipients} recipients</div>
              <div>Subject: <strong>{subject}</strong></div>
            </div>
            <div style={{ background: "#fff", padding: 24, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)" }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: "#0c0e13" }}>Sentinel</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#0c0e13", marginBottom: 14 }}>{subject}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#3a3e48", whiteSpace: "pre-wrap" }}>{body}</div>
              <div style={{ marginTop: 22, paddingTop: 14, borderTop: "1px solid #e5e7eb", fontSize: 11, color: "#9ca3af" }}>
                You're receiving this as the primary contact for {"{{company}}"}. Manage email preferences in the client portal.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { TicketsPage, AnnouncementPage });
