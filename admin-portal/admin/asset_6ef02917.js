/* ============================================================
   APP — wires everything together
   ============================================================ */

const PAGE_TITLES = {
  dashboard:  "Dashboard",
  activity:   "Live activity",
  clients:    "All clients",
  "new-client": "New client",
  pending:    "Pending approvals",
  blocked:    "Blocked accounts",
  payments:   "Payments",
  invoices:   "Invoices",
  earnings:   "Earnings",
  overdue:    "Delayed / overdue",
  agents:     "Agent configs",
  kb:         "Knowledge base",
  health:     "System health",
  tickets:    "Help tickets",
  announce:   "Send announcement",
  admins:     "Admin users",
  config:     "Platform configuration",
  audit:      "Audit log",
};

const App = () => {
  const [active, setActive] = useState("dashboard");
  const [drawerClient, setDrawerClient] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd+K handler
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setDrawerClient(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const renderPage = () => {
    switch (active) {
      case "dashboard":   return <DashboardPage onOpenClient={setDrawerClient} onNavigate={setActive} />;
      case "activity":    return <DashboardPage onOpenClient={setDrawerClient} onNavigate={setActive} />;
      case "clients":     return <ClientsPage onOpenClient={setDrawerClient} />;
      case "pending":     return <ClientsPage onOpenClient={setDrawerClient} filterStatus="Trial" />;
      case "blocked":     return <ClientsPage onOpenClient={setDrawerClient} filterStatus="Blocked" />;
      case "new-client":  return <NewClientPage />;
      case "payments":    return <PaymentsPage />;
      case "overdue":     return <PaymentsPage />;
      case "invoices":    return <PaymentsPage />;
      case "earnings":    return <EarningsPage />;
      case "agents":      return <AgentConfigsPage />;
      case "health":      return <SystemHealthPage />;
      case "tickets":     return <TicketsPage />;
      case "announce":    return <AnnouncementPage />;
      case "audit":       return <AuditLogPage />;
      case "admins":      return <AdminUsersPage />;
      case "config":      return <AdminUsersPage />;
      case "kb":          return <PageStub icon="book" title="Knowledge base management" description="Curate the system-wide knowledge base templates clients can clone." />;
      default:            return <PageStub title="Coming soon" description="This section is not yet implemented." />;
    }
  };

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar active={active} onNavigate={setActive} />
        <div className="main-col">
          <HeaderBar title={PAGE_TITLES[active] || "Dashboard"} onSearch={() => setPaletteOpen(true)} />
          <div className="content">{renderPage()}</div>
        </div>
      </div>

      {drawerClient && <ClientDrawer client={drawerClient} onClose={() => setDrawerClient(null)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setActive} />
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
