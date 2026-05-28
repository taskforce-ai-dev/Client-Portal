/* ============================================================
   PLATFORM — Agent Configs + System Health
   ============================================================ */

const AgentConfigsPage = () => {
  const [editing, setEditing] = useState(null);
  const [templates, setTemplates] = useState(AGENT_TEMPLATES);
  const toast = useToast();

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel">
          <SectionHeader
            title="Agent type templates"
            subtitle="Underlying configuration for agent types clients can provision. Clients never see these."
            action={<button className="btn btn-primary btn-sm"><Icon name="plus" size={12} />New template</button>}
          />
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {templates.map((t) => (
              <div key={t.id} className="panel-flat" style={{ padding: 14, cursor: "pointer", position: "relative" }} onClick={() => setEditing(t)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>{t.name}</div>
                  <div className={"toggle " + (t.active ? "on" : "")} onClick={(e) => { e.stopPropagation(); setTemplates(templates.map((x) => x.id === t.id ? { ...x, active: !x.active } : x)); }} />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6, minHeight: 28 }}>{t.description}</div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontFamily: "var(--ff-mono)", fontSize: 11, lineHeight: 1.7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-3)" }}>Model</span><span style={{ color: "var(--text-1)" }}>{t.model}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-3)" }}>Voice</span><span style={{ color: "var(--text-1)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.voice.split(" — ")[0]}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-3)" }}>Channel</span><span style={{ color: "var(--text-1)" }}>{t.channel}</span></div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontFamily: "var(--ff-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-3)" }}>Voice/min</span>
                  <span style={{ color: "var(--text-0)" }}>${t.voiceCost.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Global platform defaults" subtitle="System-wide policies that apply to every agent and account." />
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <Field label="Default language">
              <select className="input"><option>English (US)</option><option>English (UK)</option><option>Spanish</option><option>French</option></select>
            </Field>
            <Field label="Transcript retention">
              <select className="input" defaultValue="180 days"><option>30 days</option><option>90 days</option><option>180 days</option><option>1 year</option><option>Indefinite</option></select>
            </Field>
            <Field label="Webhook timeout (s)">
              <input className="input mono" defaultValue="15" />
            </Field>
            <Field label="Max retries on failure">
              <input className="input mono" defaultValue="3" />
            </Field>
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max agents per plan tier</div>
            <table className="data-table" style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
              <thead><tr><th>Plan</th><th style={{ textAlign: "right" }}>Agents</th><th style={{ textAlign: "right" }}>Calls / month</th><th style={{ textAlign: "right" }}>Storage</th></tr></thead>
              <tbody>
                <tr><td><PlanBadge plan="Starter"/></td><td style={{ textAlign:"right" }}>2</td><td style={{ textAlign:"right" }}>500</td><td style={{ textAlign:"right" }}>5 GB</td></tr>
                <tr><td><PlanBadge plan="Growth"/></td><td style={{ textAlign:"right" }}>5</td><td style={{ textAlign:"right" }}>3,000</td><td style={{ textAlign:"right" }}>25 GB</td></tr>
                <tr><td><PlanBadge plan="Pro"/></td><td style={{ textAlign:"right" }}>10</td><td style={{ textAlign:"right" }}>10,000</td><td style={{ textAlign:"right" }}>100 GB</td></tr>
                <tr><td><PlanBadge plan="Enterprise"/></td><td style={{ textAlign:"right" }}>Unlimited</td><td style={{ textAlign:"right" }}>Unlimited</td><td style={{ textAlign:"right" }}>1 TB</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && <AgentTemplateDrawer template={editing} onClose={() => setEditing(null)} onSave={() => { toast("Template saved", "success"); setEditing(null); }} />}
    </>
  );
};

const AgentTemplateDrawer = ({ template, onClose, onSave }) => {
  const [t, setT] = useState({ ...template });
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" style={{ width: 600 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Editing template</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{t.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Template name"><input className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
            <Field label="Internal ID"><input className="input mono" value={t.id} disabled style={{ color: "var(--text-3)" }} /></Field>
          </div>
          <Field label="Description"><textarea className="input" rows={2} value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Language model settings</div>
            <Field label="Response style">
              <div style={{ display: "flex", gap: 6 }}>
                {["concise", "balanced", "detailed"].map((s) => (
                  <button key={s} className={"btn btn-sm " + (t.model === s ? "btn-primary" : "btn-secondary")} style={{ flex: 1, textTransform: "capitalize" }} onClick={() => setT({ ...t, model: s })}>{s}</button>
                ))}
              </div>
            </Field>
            <Field label="Max response length (tokens)" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" className="slider" min={64} max={2048} step={32} defaultValue={512} style={{ flex: 1 }} />
                <span className="mono" style={{ width: 50, textAlign: "right", color: "var(--text-0)", fontSize: 12 }}>512</span>
              </div>
            </Field>
            <Field label="Temperature" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" className="slider" min={0} max={100} defaultValue={35} style={{ flex: 1 }} />
                <span className="mono" style={{ width: 50, textAlign: "right", color: "var(--text-0)", fontSize: 12 }}>0.35</span>
              </div>
            </Field>
            <Field label="System prompt template" style={{ marginTop: 14 }}>
              <textarea className="input mono" rows={5} defaultValue={`You are a ${t.name.toLowerCase()} agent for {{client_company}}. Be professional and concise. Always confirm caller intent before transferring. Use the knowledge base when relevant.`} />
            </Field>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Voice settings</div>
            <Field label="Voice profile">
              <select className="input" value={t.voice} onChange={(e) => setT({ ...t, voice: e.target.value })}>
                <option>Voice A — Professional Male</option>
                <option>Voice B — Warm Female</option>
                <option>Voice C — Neutral Female</option>
                <option>Voice D — Confident Male</option>
                <option>Voice E — Friendly Female</option>
              </select>
            </Field>
            <Field label="Speaking rate" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" className="slider" min={50} max={150} defaultValue={100} style={{ flex: 1 }} />
                <span className="mono" style={{ width: 50, textAlign: "right", color: "var(--text-0)", fontSize: 12 }}>1.0x</span>
              </div>
            </Field>
            <Field label="Stability" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" className="slider" min={0} max={100} defaultValue={72} style={{ flex: 1 }} />
                <span className="mono" style={{ width: 50, textAlign: "right", color: "var(--text-0)", fontSize: 12 }}>0.72</span>
              </div>
            </Field>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Channel configuration</div>
            <div style={{ display: "flex", gap: 14 }}>
              {["Voice", "WhatsApp"].map((c) => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5 }}>
                  <div className={"checkbox" + (t.channel.includes(c) ? " checked" : "")} />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Pricing (admin-set)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <Field label="Voice Agent / min">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>$</span>
                  <input className="input mono" value={t.voiceCost.toFixed(2)} onChange={(e) => setT({ ...t, voiceCost: parseFloat(e.target.value) || 0 })} />
                </div>
              </Field>
              <Field label="AI Agent / 1K">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>$</span>
                  <input className="input mono" value={t.aiCost.toFixed(2)} onChange={(e) => setT({ ...t, aiCost: parseFloat(e.target.value) || 0 })} />
                </div>
              </Field>
              <Field label="Call Cost / min">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text-3)", fontFamily: "var(--ff-mono)" }}>$</span>
                  <input className="input mono" value={t.callCost.toFixed(3)} onChange={(e) => setT({ ...t, callCost: parseFloat(e.target.value) || 0 })} />
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={onSave}>Save template</button>
        </div>
      </aside>
    </>
  );
};

/* ============================================================
   SYSTEM HEALTH PAGE — live updating
   ============================================================ */

const SystemHealthPage = () => {
  const [tick, setTick] = useState(0);
  const [services, setServices] = useState(SERVICES);
  const [metrics, setMetrics] = useState({
    calls: 18, msgsPerMin: 412, apiPerMin: 8420, errorRate: 0.18,
    callsHistory: Array.from({ length: 20 }, () => 15 + Math.random() * 12),
    msgsHistory: Array.from({ length: 20 }, () => 380 + Math.random() * 60),
    apiHistory: Array.from({ length: 20 }, () => 8000 + Math.random() * 900),
    errorHistory: Array.from({ length: 20 }, () => 0.12 + Math.random() * 0.14),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setMetrics((m) => ({
        calls: Math.max(12, Math.min(28, m.calls + Math.round((Math.random() - 0.5) * 4))),
        msgsPerMin: Math.round(380 + Math.random() * 80),
        apiPerMin: Math.round(7800 + Math.random() * 1200),
        errorRate: +(0.12 + Math.random() * 0.18).toFixed(2),
        callsHistory: [...m.callsHistory.slice(1), Math.max(12, Math.min(28, m.calls + Math.round((Math.random() - 0.5) * 4)))],
        msgsHistory:  [...m.msgsHistory.slice(1),  380 + Math.random() * 60],
        apiHistory:   [...m.apiHistory.slice(1),   8000 + Math.random() * 900],
        errorHistory: [...m.errorHistory.slice(1), 0.12 + Math.random() * 0.14],
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const anyDegraded = services.some((s) => s.status === "Degraded");
  const anyOutage = services.some((s) => s.status === "Outage");
  const overallStatus = anyOutage ? "Outage" : anyDegraded ? "Degraded" : "Operational";
  const statusCls = anyOutage ? "rose pulse" : anyDegraded ? "amber" : "emerald";
  const statusLabel = anyOutage ? "Outage detected" : anyDegraded ? "Partial degradation" : "All systems operational";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="panel" style={{ padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 14, height: 14 }}>
          <span className={"dot " + statusCls} style={{ width: 14, height: 14, marginRight: 0, boxShadow: anyOutage ? "0 0 0 6px rgba(244,63,94,0.15)" : anyDegraded ? "0 0 0 6px rgba(245,158,11,0.15)" : "0 0 0 6px rgba(16,185,129,0.15)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{statusLabel}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--ff-mono)" }}>
            Last checked: {new Date().toLocaleTimeString("en-GB")} UTC · auto-refresh every 5s
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setTick(tick + 1)}><Icon name="refresh" size={12} />Force check</button>
      </div>

      {/* Live metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <LiveMetric label="Active calls" value={metrics.calls} history={metrics.callsHistory} color="#ef4444" />
        <LiveMetric label="Messages / min" value={metrics.msgsPerMin.toLocaleString()} history={metrics.msgsHistory} color="#38bdf8" />
        <LiveMetric label="API req / min" value={fmtAbbrev(metrics.apiPerMin)} history={metrics.apiHistory} color="#10b981" />
        <LiveMetric label="Error rate" value={metrics.errorRate.toFixed(2)} suffix="%" history={metrics.errorHistory} color="#f59e0b" />
      </div>

      {/* Service grid */}
      <div className="panel">
        <SectionHeader title="Services" subtitle="Real-time health of all platform services." />
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {services.map((s) => (
            <div key={s.name} className="panel-flat" style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
              <span className={"dot " + (s.status === "Operational" ? "emerald" : s.status === "Degraded" ? "amber" : "rose pulse")} style={{ marginRight: 0, width: 8, height: 8 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-0)" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--ff-mono)", marginTop: 2 }}>Last incident: {s.lastIncident}</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--ff-mono)" }}>
                <div style={{ fontSize: 13, color: s.uptime >= 99.95 ? "#6ee7b7" : s.uptime >= 99.9 ? "#fcd34d" : "#fda4af" }}>{s.uptime.toFixed(2)}%</div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{s.latency} ms p95</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Incident log */}
      <div className="panel">
        <SectionHeader title="Incident log" subtitle="Last 30 days" action={<button className="btn btn-ghost btn-sm">View full history</button>} />
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Service</th>
              <th>Severity</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {INCIDENTS.map((inc, i) => (
              <tr key={i}>
                <td style={{ color: "var(--text-2)" }}>{inc.date}</td>
                <td style={{ color: "var(--text-0)", fontFamily: "var(--ff-sans)" }}>{inc.service}</td>
                <td>
                  <span style={{ color: inc.severity === "Critical" ? "#fda4af" : inc.severity === "Major" ? "#fcd34d" : "#7dd3fc" }}>
                    {inc.severity}
                  </span>
                </td>
                <td style={{ color: "var(--text-1)" }}>{inc.duration}</td>
                <td><StatusDot status={inc.status} /></td>
                <td style={{ color: "var(--text-2)", fontFamily: "var(--ff-sans)" }}>{inc.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LiveMetric = ({ label, value, suffix = "", history, color }) => (
  <div className="kpi">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value" style={{ marginTop: 6 }}>{value}{suffix}</div>
      </div>
      <Sparkline data={history} width={70} height={28} color={color} />
    </div>
    <div style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--ff-mono)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
      <span className="dot emerald" style={{ marginRight: 0, width: 4, height: 4 }} />
      <span>live · updates every 5s</span>
    </div>
  </div>
);

Object.assign(window, { AgentConfigsPage, SystemHealthPage });
