export type ClientStatus = "trial" | "active" | "suspended";
export type AgentStatus = "live" | "paused" | "draft";
export type AgentChannel = "voice" | "whatsapp";

export type Admin = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  // Stored for the admin to hand credentials to the client. Internal admin tool.
  password: string;
  passwordHash: string;
  status: ClientStatus;
  createdAt: string;
};

export type Salesperson = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
};

export type Agent = {
  id: string;
  clientId: string;
  name: string;
  role: string;
  channel: AgentChannel;
  status: AgentStatus;
  salespersonId: string | null;
  // Commission as a percentage of the agent's sales (e.g. 10 = 10%).
  commissionPercent: number;
  createdAt: string;
};

export type Sale = {
  id: string;
  agentId: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  createdAt: string;
};

export type DB = {
  admins: Admin[];
  clients: Client[];
  salespeople: Salesperson[];
  agents: Agent[];
  sales: Sale[];
};
