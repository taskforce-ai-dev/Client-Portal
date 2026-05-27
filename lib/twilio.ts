import { calls as mockCalls } from "./data";

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

export type DisplayCall = {
  id: string;
  caller: string;
  number: string;
  startedAt: string;
  startedAtIso: string;
  duration: string;
  durationSec: number;
  outcome: "Booked" | "Follow-up" | "Voicemail" | "No answer" | "Cancelled";
  sentiment: "positive" | "neutral" | "negative";
  direction: "inbound" | "outbound";
  recordingUrl?: string | null;
};

export type DataSource = "twilio" | "mock";

export function isTwilioConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID
  );
}

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

async function twilioGet(path: string) {
  const res = await fetch(`${TWILIO_BASE}${path}`, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twilio ${res.status}: ${body.slice(0, 240)}`);
  }
  return res.json();
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (d >= todayStart) {
    return "Today, " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d >= yesterday) return "Yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} days ago`;
  return d.toLocaleDateString();
}

function mapStatusToOutcome(status: string): DisplayCall["outcome"] {
  switch (status) {
    case "completed":
      return "Booked";
    case "no-answer":
      return "No answer";
    case "busy":
      return "No answer";
    case "failed":
      return "Cancelled";
    case "canceled":
      return "Cancelled";
    case "voicemail":
      return "Voicemail";
    default:
      return "Follow-up";
  }
}

type TwilioCall = {
  sid: string;
  from: string;
  from_formatted: string;
  to: string;
  to_formatted: string;
  direction: string;
  status: string;
  duration: string;
  start_time: string;
  subresource_uris?: { recordings?: string };
};

function mapCall(c: TwilioCall): DisplayCall {
  const dur = parseInt(c.duration || "0", 10);
  const direction = (c.direction || "").startsWith("inbound") ? "inbound" : "outbound";
  const other = direction === "inbound" ? c.from_formatted || c.from : c.to_formatted || c.to;
  return {
    id: c.sid,
    caller: other,
    number: other,
    startedAt: relativeTime(c.start_time),
    startedAtIso: c.start_time,
    duration: formatDuration(dur),
    durationSec: dur,
    outcome: mapStatusToOutcome(c.status),
    sentiment: "neutral",
    direction,
  };
}

function mockToDisplay(): DisplayCall[] {
  return mockCalls.map((c) => ({
    id: c.id,
    caller: c.caller,
    number: c.number,
    startedAt: c.startedAt,
    startedAtIso: "",
    duration: c.duration,
    durationSec: parseInt(c.duration.split(":")[0], 10) * 60 + parseInt(c.duration.split(":")[1], 10),
    outcome: c.outcome,
    sentiment: c.sentiment,
    direction: "inbound",
  }));
}

export async function getCalls(limit = 50): Promise<{
  calls: DisplayCall[];
  source: DataSource;
  error?: string;
}> {
  if (!isTwilioConfigured()) {
    return { calls: mockToDisplay(), source: "mock" };
  }
  try {
    const sub = process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID!;
    const data = await twilioGet(`/Accounts/${sub}/Calls.json?PageSize=${limit}`);
    const raw = (data.calls ?? []) as TwilioCall[];
    return { calls: raw.map(mapCall), source: "twilio" };
  } catch (e) {
    return {
      calls: mockToDisplay(),
      source: "mock",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getUsageThisMonth(): Promise<{
  source: DataSource;
  totalCalls: number;
  totalMinutes: number;
  totalPrice: number;
  error?: string;
}> {
  if (!isTwilioConfigured()) {
    return { source: "mock", totalCalls: 100, totalMinutes: 1820, totalPrice: 189 };
  }
  try {
    const sub = process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID!;
    const data = await twilioGet(
      `/Accounts/${sub}/Usage/Records/ThisMonth.json?Category=calls`
    );
    const records = (data.usage_records ?? []) as Array<{
      count: string;
      usage: string;
      usage_unit: string;
      price: string;
    }>;
    let totalCalls = 0;
    let totalMinutes = 0;
    let totalPrice = 0;
    for (const r of records) {
      totalCalls += parseInt(r.count || "0", 10);
      const usage = parseFloat(r.usage || "0");
      totalMinutes += r.usage_unit === "minutes" ? usage : usage / 60;
      totalPrice += parseFloat(r.price || "0");
    }
    return { source: "twilio", totalCalls, totalMinutes, totalPrice };
  } catch (e) {
    return {
      source: "mock",
      totalCalls: 100,
      totalMinutes: 1820,
      totalPrice: 189,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function bucketCallsByHour(calls: DisplayCall[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byHour = new Map<number, number>();
  for (const c of calls) {
    if (!c.startedAtIso) continue;
    const d = new Date(c.startedAtIso);
    if (isNaN(d.getTime()) || d < today) continue;
    const h = d.getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  return hours.map((h) => ({
    hour: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
    calls: byHour.get(h) ?? byHour.get(h - 1) ?? 0,
  }));
}

export function bucketCallsByDay(calls: DisplayCall[]) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const buckets: { day: string; calls: number; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({ day: labels[d.getDay()], calls: 0, date: d });
  }
  for (const c of calls) {
    if (!c.startedAtIso) continue;
    const d = new Date(c.startedAtIso);
    if (isNaN(d.getTime())) continue;
    for (const b of buckets) {
      const next = new Date(b.date);
      next.setDate(next.getDate() + 1);
      if (d >= b.date && d < next) {
        b.calls += 1;
        break;
      }
    }
  }
  return buckets.map(({ day, calls }) => ({ day, calls }));
}

export function bucketOutcomes(calls: DisplayCall[]) {
  const colors: Record<DisplayCall["outcome"], string> = {
    Booked: "#34D399",
    "Follow-up": "#22D3EE",
    Voicemail: "#FBBF24",
    "No answer": "#94A3B8",
    Cancelled: "#FB7185",
  };
  const counts = new Map<DisplayCall["outcome"], number>();
  for (const c of calls) {
    counts.set(c.outcome, (counts.get(c.outcome) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([outcome, count]) => ({
    outcome,
    count,
    color: colors[outcome],
  }));
}

export function callsToday(calls: DisplayCall[]) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return calls.filter((c) => {
    if (!c.startedAtIso) return false;
    const d = new Date(c.startedAtIso);
    return !isNaN(d.getTime()) && d >= todayStart;
  });
}
