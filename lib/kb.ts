import { promises as fs } from "fs";
import os from "os";
import path from "path";

const KB_API_URL = process.env.KB_API_URL;
const KB_API_KEY = process.env.KB_API_KEY;

export function isKbServiceConfigured() {
  return !!KB_API_URL;
}

function authHeaders(): Record<string, string> {
  return KB_API_KEY ? { Authorization: `Bearer ${KB_API_KEY}` } : {};
}

function safeId(agentId: string) {
  return agentId.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
}

const localDir = path.join(os.tmpdir(), "kb-store");
function localFile(agentId: string) {
  return path.join(localDir, `${safeId(agentId)}.md`);
}

async function readLocal(agentId: string): Promise<string> {
  try {
    return await fs.readFile(localFile(agentId), "utf8");
  } catch {
    return DEFAULT_KB;
  }
}

async function writeLocal(agentId: string, content: string): Promise<void> {
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(localFile(agentId), content, "utf8");
}

export type KbResult = {
  content: string;
  configured: boolean;
  source: "service" | "local";
};

export async function getKbContent(agentId: string): Promise<KbResult> {
  if (KB_API_URL) {
    const res = await fetch(`${KB_API_URL}/kb/${safeId(agentId)}`, {
      headers: { ...authHeaders() },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`KB service ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return { content: data.content ?? "", configured: true, source: "service" };
  }
  return { content: await readLocal(agentId), configured: false, source: "local" };
}

export async function saveKbContent(agentId: string, content: string): Promise<KbResult> {
  if (KB_API_URL) {
    const res = await fetch(`${KB_API_URL}/kb/${safeId(agentId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error(`KB service ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return { content: data.content ?? content, configured: true, source: "service" };
  }
  await writeLocal(agentId, content);
  return { content, configured: false, source: "local" };
}

export type ConvertResult = {
  filename: string;
  markdown: string;
  content: string;
};

export async function convertPdf(agentId: string, file: File): Promise<ConvertResult> {
  if (!KB_API_URL) {
    throw new Error("KB service not connected — set KB_API_URL to enable PDF conversion.");
  }
  const out = new FormData();
  out.append("file", file, file.name || "upload.pdf");
  const res = await fetch(`${KB_API_URL}/kb/${safeId(agentId)}/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: out,
  });
  if (!res.ok) {
    throw new Error(`KB service ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

export const DEFAULT_KB = `# Tree House Chalets — Knowledge Base

This is the knowledge Kavya uses to answer guest calls. Edit it freely —
write it the way you'd explain things to a new front-desk staff member.

## About us

Tree House Chalets offers elevated cabin stays surrounded by forest, a short
drive from town. Each chalet is self-contained with its own deck and views.

## Pricing & seasons

- **Peak (Dec–Jan, school holidays):** from $420/night, 2-night minimum.
- **Shoulder (Sep–Nov, Feb–Apr):** from $320/night.
- **Off-peak (May–Aug):** from $260/night.
- Rates include cleaning. A 2-night minimum applies on weekends year-round.

## Amenities

- Queen or king beds, full kitchen, wood heater, air-conditioning.
- Free Wi-Fi and off-street parking.
- Outdoor deck with BBQ; some chalets have a spa bath.

## Booking & cancellation policy

- Free cancellation up to 14 days before check-in.
- 7–13 days: 50% refund. Inside 7 days: non-refundable.
- Check-in 3:00 PM, check-out 10:00 AM. Self check-in via keypad.

## FAQ

**Are pets allowed?** Yes, in pet-friendly chalets only — please ask when booking.
**Is parking available?** Yes, one space per chalet, free.
**Do you allow events/parties?** No — these are quiet, residential-style stays.
`;
