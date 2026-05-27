export type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  status: "active" | "onboarding" | "paused";
  plan: "Starter" | "Growth" | "Enterprise";
  mrr: number;
  joined: string;
};

export type Project = {
  id: string;
  name: string;
  client: string;
  progress: number;
  status: "on-track" | "at-risk" | "blocked" | "done";
  due: string;
  owner: string;
};

export type Invoice = {
  id: string;
  client: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  issued: string;
  due: string;
};

export type Message = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
};

export type Activity = {
  id: string;
  who: string;
  action: string;
  target: string;
  time: string;
};

export const clients: Client[] = [
  { id: "c1", name: "Sarah Chen", company: "Northwind Labs", email: "sarah@northwind.io", status: "active", plan: "Enterprise", mrr: 4800, joined: "2024-03-12" },
  { id: "c2", name: "Marcus Lee", company: "Helios Robotics", email: "marcus@helios.co", status: "active", plan: "Growth", mrr: 1900, joined: "2024-07-02" },
  { id: "c3", name: "Priya Raman", company: "Lumen Analytics", email: "priya@lumen.dev", status: "onboarding", plan: "Growth", mrr: 1900, joined: "2026-05-10" },
  { id: "c4", name: "Daniel Ortiz", company: "Vertex Studios", email: "dan@vertex.studio", status: "active", plan: "Starter", mrr: 490, joined: "2025-11-21" },
  { id: "c5", name: "Aiko Tanaka", company: "Kintsugi Health", email: "aiko@kintsugi.health", status: "paused", plan: "Growth", mrr: 0, joined: "2024-01-05" },
  { id: "c6", name: "Owen Walsh", company: "Brightline AI", email: "owen@brightline.ai", status: "active", plan: "Enterprise", mrr: 6200, joined: "2023-09-18" },
];

export const projects: Project[] = [
  { id: "p1", name: "Onboarding Flow Redesign", client: "Northwind Labs", progress: 78, status: "on-track", due: "2026-06-14", owner: "Sarah Chen" },
  { id: "p2", name: "Inventory API v2", client: "Helios Robotics", progress: 42, status: "at-risk", due: "2026-06-02", owner: "Marcus Lee" },
  { id: "p3", name: "Data Pipeline Migration", client: "Lumen Analytics", progress: 12, status: "blocked", due: "2026-07-30", owner: "Priya Raman" },
  { id: "p4", name: "Marketing Site Refresh", client: "Vertex Studios", progress: 95, status: "on-track", due: "2026-05-29", owner: "Daniel Ortiz" },
  { id: "p5", name: "Compliance Audit Q2", client: "Brightline AI", progress: 100, status: "done", due: "2026-05-20", owner: "Owen Walsh" },
];

export const invoices: Invoice[] = [
  { id: "INV-2041", client: "Northwind Labs", amount: 4800, status: "paid", issued: "2026-05-01", due: "2026-05-15" },
  { id: "INV-2042", client: "Helios Robotics", amount: 1900, status: "paid", issued: "2026-05-01", due: "2026-05-15" },
  { id: "INV-2043", client: "Vertex Studios", amount: 490, status: "pending", issued: "2026-05-12", due: "2026-05-30" },
  { id: "INV-2044", client: "Brightline AI", amount: 6200, status: "overdue", issued: "2026-04-22", due: "2026-05-06" },
  { id: "INV-2045", client: "Lumen Analytics", amount: 1900, status: "pending", issued: "2026-05-20", due: "2026-06-03" },
];

export const messages: Message[] = [
  { id: "m1", from: "Sarah Chen", subject: "Re: Onboarding flow review", preview: "Looks great — one tweak on step 3 copy. Can we…", time: "2h", unread: true },
  { id: "m2", from: "Marcus Lee", subject: "API v2 timeline", preview: "We hit a snag on the auth service. Pushing the…", time: "5h", unread: true },
  { id: "m3", from: "Daniel Ortiz", subject: "Launch checklist", preview: "Everything's green on our end. Ready when you are.", time: "1d", unread: false },
  { id: "m4", from: "Owen Walsh", subject: "Q2 audit signed off", preview: "All clear. Thanks for the fast turnaround.", time: "2d", unread: false },
];

export const activity: Activity[] = [
  { id: "a1", who: "Sarah Chen", action: "approved", target: "Onboarding mockups v3", time: "12 min ago" },
  { id: "a2", who: "You", action: "sent invoice", target: "INV-2045 to Lumen Analytics", time: "1 hr ago" },
  { id: "a3", who: "Marcus Lee", action: "commented on", target: "Inventory API v2", time: "3 hr ago" },
  { id: "a4", who: "Priya Raman", action: "uploaded", target: "kickoff-deck.pdf", time: "Yesterday" },
  { id: "a5", who: "Owen Walsh", action: "paid", target: "INV-2038", time: "2 days ago" },
];

export const revenueByMonth = [
  { month: "Dec", revenue: 12200 },
  { month: "Jan", revenue: 13100 },
  { month: "Feb", revenue: 13800 },
  { month: "Mar", revenue: 14500 },
  { month: "Apr", revenue: 14900 },
  { month: "May", revenue: 15290 },
];

export const projectsByStatus = [
  { status: "On track", count: 12 },
  { status: "At risk", count: 4 },
  { status: "Blocked", count: 2 },
  { status: "Done", count: 27 },
];
