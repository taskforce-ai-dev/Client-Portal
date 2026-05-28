export type AgentChannel = "Voice Call" | "WhatsApp" | "SMS";
export type AgentStatus = "live" | "paused" | "draft";

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  channels: AgentChannel[];
  gradient: string;
  initial: string;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  type: "PDF" | "URL" | "Doc" | "FAQ";
  size: string;
  updated: string;
  status: "indexed" | "indexing" | "failed";
};

export type Invoice = {
  id: string;
  period: string;
  amount: number;
  minutes: number;
  status: "paid" | "pending" | "overdue";
  issued: string;
};

export const workspace = {
  name: "Tree House Chalets",
  email: "hello@treehousechalets.com",
  plan: "Growth",
  minutesLimit: 5000,
};

export const agents: Agent[] = [
  {
    id: "kavya",
    name: "Kavya",
    role: "Booking Agent",
    status: "live",
    channels: ["Voice Call", "WhatsApp"],
    gradient: "from-violet-400 to-fuchsia-500",
    initial: "K",
  },
];

export const docs: KnowledgeDoc[] = [
  { id: "kb1", title: "Chalet pricing & seasons 2026", type: "PDF",  size: "412 KB",  updated: "2 days ago",  status: "indexed"  },
  { id: "kb2", title: "Amenities & inclusions",         type: "Doc",  size: "88 KB",   updated: "1 week ago",  status: "indexed"  },
  { id: "kb3", title: "Booking & cancellation policy",  type: "PDF",  size: "210 KB",  updated: "1 week ago",  status: "indexed"  },
  { id: "kb4", title: "FAQ — pets, check-in, parking",  type: "FAQ",  size: "24 items",updated: "Today",       status: "indexing" },
  { id: "kb5", title: "Local area guide",               type: "URL",  size: "treehousechalets.com/area", updated: "3 weeks ago", status: "indexed"  },
  { id: "kb6", title: "Property photos & descriptions", type: "Doc",  size: "1.4 MB",  updated: "Yesterday",   status: "indexed"  },
];

export const invoices: Invoice[] = [
  { id: "INV-0042", period: "May 2026",   amount: 189, minutes: 1820, status: "pending", issued: "2026-05-26" },
  { id: "INV-0041", period: "April 2026", amount: 224, minutes: 2240, status: "paid",    issued: "2026-04-26" },
  { id: "INV-0040", period: "March 2026", amount: 198, minutes: 1980, status: "paid",    issued: "2026-03-26" },
  { id: "INV-0039", period: "Feb 2026",   amount: 167, minutes: 1670, status: "paid",    issued: "2026-02-26" },
];
