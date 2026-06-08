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

  /* AI structuring overlay state */
  const [aiOpen, setAiOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [structureMode, setStructureMode] = useState("merge");
  const [structurePending, setStructurePending] = useState(false);
  const [structureResult, setStructureResult] = useState(null);

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

  /* close AI overlay on Escape */
  useEffect(() => {
    if (!aiOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeAi(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiOpen]);

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
      toast("Knowledge base saved — synced to client portal and agent", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleClient = (id) =>
    setExpanded(prev => Object.assign({}, prev, { [id]: !prev[id] }));

  /* ── AI Structuring ── */
  const openAi = () => {
    setStructureResult(null);
    setRawInput("");
    setStructureMode("merge");
    setAiOpen(true);
  };

  const closeAi = () => {
    setAiOpen(false);
    setStructureResult(null);
  };

  const runStructure = async () => {
    if (!rawInput.trim()) { toast("Paste some text first", "error"); return; }
    setStructurePending(true);
    setStructureResult(null);
    try {
      const r = await fetch("/api/admin/knowledge-base/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agentId: selectedAgent ? selectedAgent.id : undefined,
          rawText: rawInput,
          mode: structureMode,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Structure failed");
      setStructureResult(d);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setStructurePending(false);
    }
  };

  const applyStructure = () => {
    if (!structureResult) return;
    handleChange(structureResult.structuredContent);
    closeAi();
    toast("AI-structured content applied — review and save when ready", "success");
  };

  /* ── Render ── */

  if (pageLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 300, color: "var(--text-2)", fontSize: 14 }}>
        Loading knowledge bases...
      </div>
    );
  }

  return (
    <>
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
                  width: "100%", textAlign: "left",
                  background: expanded[client.id] ? "rgba(255,255,255,0.04)" : "none",
                  border: "none", cursor: "pointer",
                  padding: "7px 10px", borderRadius: 6, marginBottom: 2,
                  color: "var(--text-1)", fontSize: 13, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span style={{ fontSize: 9, color: "var(--text-3)", flexShrink: 0,
                  display: "inline-block",
                  transform: expanded[client.id] ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s",
                }}>▶</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", flex: 1 }}>
                  {client.company}
                </span>
              </button>
              {expanded[client.id] && client.agents && client.agents.map(agent => {
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
                    onClick={openAi}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                      background: "linear-gradient(135deg, #7c3aed, #a21caf)",
                      color: "#fff", border: "none", fontWeight: 500,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <span>✦</span> AI Structure
                  </button>
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
                {" — "}Ctrl+S / Cmd+S to save
                {" — "}Changes sync to client portal and agent
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── AI Structuring Overlay ── */}
      {aiOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeAi(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{
            background: "var(--surface, #1a1a2e)", border: "1px solid var(--border)",
            borderRadius: 12, width: "100%", maxWidth: structureResult ? 1100 : 640,
            maxHeight: "90vh", display: "flex", flexDirection: "column",
            overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-0)", fontSize: 15 }}>
                  ✦ AI Knowledge Base Structurer
                </div>
                {selectedAgent && (
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    Agent: {selectedAgent.name}
                  </div>
                )}
              </div>
              <button onClick={closeAi} style={{ background: "none", border: "none",
                cursor: "pointer", color: "var(--text-3)", fontSize: 20, lineHeight: 1,
                padding: "2px 6px", borderRadius: 4 }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 0 }}>
              {/* Left: raw input */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px",
                borderRight: structureResult ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8, fontWeight: 500 }}>
                  Paste raw content (brochure, PDF text, notes, rate sheet…)
                </div>
                <textarea
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  placeholder="Paste unstructured business content here — hotel rates, room descriptions, policies, contact info, etc."
                  style={{
                    flex: 1, resize: "none", padding: "10px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                    color: "var(--text-0)", fontSize: 13, fontFamily: "ui-monospace, monospace",
                    lineHeight: 1.6, outline: "none", minHeight: 200,
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--primary-ring)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
                {/* Mode selector */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>Mode:</span>
                  {[["merge", "Merge with current"], ["replace", "Replace current"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setStructureMode(val)}
                      style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                        background: structureMode === val ? "var(--primary-ring)" : "rgba(255,255,255,0.06)",
                        border: structureMode === val ? "1px solid var(--primary-ring)" : "1px solid var(--border)",
                        color: structureMode === val ? "#fff" : "var(--text-2)",
                        fontWeight: structureMode === val ? 500 : 400,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 4 }}>
                    {structureMode === "merge" ? "Integrates new info into existing KB" : "Replaces KB entirely"}
                  </span>
                </div>
                <button
                  onClick={runStructure}
                  disabled={structurePending || !rawInput.trim()}
                  style={{
                    marginTop: 12, padding: "9px 18px", borderRadius: 8, fontSize: 13,
                    fontWeight: 500, cursor: structurePending ? "wait" : "pointer",
                    background: structurePending ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg,#7c3aed,#a21caf)",
                    color: "#fff", border: "none",
                    opacity: (!rawInput.trim() && !structurePending) ? 0.5 : 1,
                  }}
                >
                  {structurePending ? "Structuring with AI…" : "✦ Structure with AI"}
                </button>
              </div>

              {/* Right: result preview (only when result exists) */}
              {structureResult && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column",
                  padding: "16px 20px", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 10, flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>
                        Structured result
                        {structureResult.businessType && (
                          <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10,
                            background: "rgba(124,58,237,0.2)", color: "#a78bfa", fontSize: 11 }}>
                            {structureResult.businessType}
                          </span>
                        )}
                      </div>
                      {structureResult.sections && structureResult.sections.length > 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                          Sections: {structureResult.sections.join(" · ")}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={applyStructure}
                      style={{
                        padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500,
                        cursor: "pointer", background: "#059669", color: "#fff", border: "none",
                      }}
                    >
                      ✓ Apply to Editor
                    </button>
                  </div>
                  {structureResult.warnings && structureResult.warnings.length > 0 && (
                    <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, marginBottom: 10,
                      fontSize: 12, color: "#fbbf24", flexShrink: 0 }}>
                      ⚠ {structureResult.warnings.join(" · ")}
                    </div>
                  )}
                  <textarea
                    readOnly
                    value={structureResult.structuredContent}
                    style={{
                      flex: 1, resize: "none", padding: "10px 12px", borderRadius: 8,
                      background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                      color: "var(--text-0)", fontSize: 13, fontFamily: "ui-monospace, monospace",
                      lineHeight: 1.6, outline: "none",
                    }}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                    {(structureResult.structuredContent || "").length.toLocaleString()} chars
                    {" — "}Click "Apply to Editor" then review and save
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
