export type AgentChannel = "Voice Call" | "WhatsApp" | "SMS";
export type AgentStatus = "live" | "paused" | "draft";

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  channels: AgentChannel[];
  callsToday: number;
  convRate: number;
  avgDuration: string;
  gradient: string;
  initial: string;
};

export type Call = {
  id: string;
  caller: string;
  number: string;
  startedAt: string;
  duration: string;
  outcome: "Booked" | "Follow-up" | "No answer" | "Voicemail" | "Cancelled";
  sentiment: "positive" | "neutral" | "negative";
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
  minutesUsed: 1820,
  minutesLimit: 5000,
};

export const agents: Agent[] = [
  {
    id: "kavya",
    name: "Kavya",
    role: "Booking Agent",
    status: "live",
    channels: ["Voice Call", "WhatsApp"],
    callsToday: 14,
    convRate: 71.4,
    avgDuration: "2:48",
    gradient: "from-violet-400 to-fuchsia-500",
    initial: "K",
  },
];

export const callsByHour = [
  { hour: "6a", calls: 0 },
  { hour: "8a", calls: 1 },
  { hour: "10a", calls: 3 },
  { hour: "12p", calls: 5 },
  { hour: "2p", calls: 4 },
  { hour: "4p", calls: 6 },
  { hour: "6p", calls: 8 },
  { hour: "8p", calls: 3 },
  { hour: "10p", calls: 1 },
];

export const callsByDay = [
  { day: "Mon", calls: 11 },
  { day: "Tue", calls: 9 },
  { day: "Wed", calls: 14 },
  { day: "Thu", calls: 12 },
  { day: "Fri", calls: 18 },
  { day: "Sat", calls: 21 },
  { day: "Sun", calls: 15 },
];

export const outcomeBreakdown = [
  { outcome: "Booked", count: 38, color: "#34D399" },
  { outcome: "Follow-up", count: 14, color: "#22D3EE" },
  { outcome: "Voicemail", count: 9, color: "#FBBF24" },
  { outcome: "No answer", count: 12, color: "#94A3B8" },
  { outcome: "Cancelled", count: 4, color: "#FB7185" },
];

export const calls: Call[] = [
  { id: "c-1042", caller: "Anya Patel",      number: "+61 412 988 221", startedAt: "Today, 5:42 PM",  duration: "3:24", outcome: "Booked",     sentiment: "positive" },
  { id: "c-1041", caller: "Daniel Brooks",   number: "+61 433 011 902", startedAt: "Today, 4:18 PM",  duration: "1:08", outcome: "No answer",  sentiment: "neutral"  },
  { id: "c-1040", caller: "Mei Lin",         number: "+61 401 552 718", startedAt: "Today, 3:51 PM",  duration: "4:02", outcome: "Booked",     sentiment: "positive" },
  { id: "c-1039", caller: "Jacob Reyes",     number: "+61 419 670 332", startedAt: "Today, 2:09 PM",  duration: "2:11", outcome: "Follow-up",  sentiment: "neutral"  },
  { id: "c-1038", caller: "Sara Whitman",    number: "+61 422 109 884", startedAt: "Today, 12:46 PM", duration: "5:14", outcome: "Booked",     sentiment: "positive" },
  { id: "c-1037", caller: "Owen Walsh",      number: "+61 416 778 002", startedAt: "Today, 11:22 AM", duration: "0:42", outcome: "Voicemail",  sentiment: "neutral"  },
  { id: "c-1036", caller: "Priya Raman",     number: "+61 405 223 119", startedAt: "Yesterday",       duration: "3:58", outcome: "Booked",     sentiment: "positive" },
  { id: "c-1035", caller: "Marcus Lee",      number: "+61 408 334 660", startedAt: "Yesterday",       duration: "1:33", outcome: "Cancelled",  sentiment: "negative" },
  { id: "c-1034", caller: "Aiko Tanaka",     number: "+61 411 990 245", startedAt: "Yesterday",       duration: "4:47", outcome: "Booked",     sentiment: "positive" },
  { id: "c-1033", caller: "Liam O'Brien",    number: "+61 415 661 887", startedAt: "2 days ago",      duration: "2:21", outcome: "Follow-up",  sentiment: "neutral"  },
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
