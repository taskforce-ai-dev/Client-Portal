/* ============================================================
   KNOWLEDGE BASE PAGE -- admin KB editor across all agents
   ============================================================ */

const KnowledgeBasePage = () => {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  /* load all KBs */
  useEffect(() => {
    let active = true;
    setPageLoading(true);
    fetch("/api/admin/kb", { credentials: "include" })
      .then(r => r.ok ? r.json() : { clients: [] })
      .then(d => {
        if (!active) return;
        setData(d);
        if (d.clients && d.clients.length > 0) {
          const fc = d.clients[0];
          setExpanded({ [fc.id]: true });
          if (fc.agents && fc.agents.length > 0) {
            const ag = fc.agents[0];
            setSelectedAgent(Object.assign({}, ag, { clientName: fc.company }));
            setContent(ag.content || "");
          }
        }
      })
      .catch(() => { if (active) setData({ clients: [] }); })
      .finally(() => { if (active) setPageLoading(false); });
    return () => { active = false; };
  }, []);

  /* Ctrl/Cmd+S shortcut */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !saving) saveKb();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, content, selectedAgent]);

  const pickAgent = (agent, clientName) => {
    setSelectedAgent(Object.assign({}, agent, { clientName }));
    setContent(agent.content || "");
    setDirty(false);
  };

  const handleChange = (val) => {
    setContent(val);
    setDirty(val !== ((selectedAgent && selectedAgent.content) || ""));
  };

  const saveKb = async () => {
    if (!selectedAgent || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/agents/" + selectedAgent.id + "/kb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Save failed");
      const saved = content;
      setSelectedAgent(prev => Object.assign({}, prev, { content: saved }));
      setData(prev => ({
        clients: prev.clients.map(c => ({
          ...c,
          agents: c.agents.map(a =>
            a.id === selectedAgent.id ? Object.assign({}, a, { content: saved }) : a
          ),
        })),
      }));
      setDirty(false);
      toast("Knowledge base saved -- synced to client portal", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleClient = (id) =>
    setExpanded(prev => Object.assign({}, prev, { [id]: !prev[id] }));

  if (pageLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 300, color: "var(--text-2)", fontSize: 14 }}>
        Loading knowledge bases...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 112px)", minHeight: 420 }}>

      {/* Left: agent tree */}
      <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid var(--border)",
        overflowY: "auto", paddingRight: 8, marginRight: 20 }}>
        {(!data || !data.clients || !data.clients.length) && (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: "12px 4px" }}>
            No agents found.
          </div>
        )}
        {data && data.clients && data.clients.map(client => (
          <div key={client.id} style={{ marginBottom: 2 }}>
            <button
              onClick={() => toggleClient(client.id)}
              style={{
                width: "100            {expanded[client.id] && client.agents && client.agents.map(agent => {
              const isSel = selectedAgent && selectedAgent.id === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => pickAgent(agent, client.company)}
                  style={{
                    width: "100%", textAlign: "left",
                    background: isSel ? "var(--primary-ring)" : "none",
                    border: "none", cursor: "pointer",
                    padding: "6px 8px 6px 24px", borderRadius: 6, marginBottom: 1,
                    color: isSel ? "var(--text-0)" : "var(--text-2)", fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", flex: 1 }}>
                    {agent.name}
                  </span>
                  {isSel && dirty && (
                    <span style={{ color: "#f59e0b", fontSize: 10, flexShrink: 0 }}>*</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Right: editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!selectedAgent ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: "var(--text-2)", fontSize: 14 }}>
            Select an agent to edit its knowledge base
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-0)", fontSize: 15 }}>
                  {selectedAgent.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  {selectedAgent.clientName}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {dirty && (
                  <span style={{ fontSize: 12, color: "#f59e0b" }}>Unsaved changes</span>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveKb}
                  disabled={!dirty || saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            <textarea
              value={content}
              onChange={e => handleChange(e.target.value)}
              spellCheck={false}
              placeholder="Enter knowledge base content in Markdown..."
              style={{
                flex: 1, width: "100%", resize: "none", padding: "12px 14px",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text-0)", fontSize: 13,
                fontFamily: "ui-monospace, monospace",
                lineHeight: 1.65, outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "var(--primary-ring)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />

            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
              {((selectedAgent.content || "").length).toLocaleString()} chars saved
              {" - "}Ctrl+S or Cmd+S to save
              {" - "}Changes sync to the client portal and GitHub
            </div>
          </>
        )}
      </div>
    </div>
  );
};
