import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { getAgentKb, isDbConfigured } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a knowledge base structurer for AI voice agents. Your task is to rewrite raw business content into a retrieval-optimized knowledge base document.

MANDATORY FORMATTING RULES:
- Write in plain paragraphs only — no markdown headers, no bullet lists, no tables
- Each paragraph must be 300–500 characters covering exactly ONE topic
- Separate every paragraph with one blank line
- Begin every paragraph with an explicit entity name (e.g. "Tree House Chalets offers...", "The Deluxe Room costs Rs. 18,000 per night...")
- Never use pronouns or forward-references ("it", "they", "the above")
- State prices, hours, and policies inline — never say "see below" or "refer to"
- Use consistent vocabulary throughout (pick one term per concept and use it every time)

SECTION INFERENCE:
Infer appropriate sections for the business type detected.
- Hotel/guesthouse: Overview, Rooms & Rates, Dining, Facilities, Policies, Location & Contact
- Retail/shop: Overview, Product Categories, Pricing & Offers, Store Info, Policies, Contact
- Restaurant: Overview, Menu & Pricing, Reservations, Hours & Location, Policies, Contact
- Clinic/healthcare: Overview, Services & Fees, Appointments, Hours & Location, Policies, Contact
- Other: infer logically from the content

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences:
{
  "structuredContent": "full restructured document as a plain string with blank-line paragraph breaks",
  "businessType": "hotel | retail | restaurant | clinic | other",
  "sections": ["Section Name 1", "Section Name 2"],
  "warnings": ["any data quality warnings, e.g. prices may be outdated, table data may have extracted incorrectly"]
}`;

export async function POST(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "ANTHROPIC_API_KEY is not configured. Add it to the Vercel environment variables." },
      { status: 501 }
    );
  }

  let body: { agentId?: string; rawText?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { agentId, rawText, mode = "replace" } = body;
  if (!rawText || rawText.trim().length < 20) {
    return NextResponse.json({ message: "rawText must be at least 20 characters" }, { status: 400 });
  }

  // For merge mode, load the current KB and append as context
  let mergeSection = "";
  if (mode === "merge" && agentId && isDbConfigured()) {
    const existing = await getAgentKb(agentId).catch(() => "");
    if (existing && existing.trim()) {
      mergeSection =
        "\n\nEXISTING KNOWLEDGE BASE (integrate the new content below into this document — " +
        "preserve unchanged sections, update changed facts, add new facts, deduplicate):\n" +
        existing.trim();
    }
  }

  const userMessage = `Raw business content to structure:\n\n${rawText.trim()}${mergeSection}`;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { message: `Anthropic API error ${res.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";

    let parsed: { structuredContent: string; businessType: string; sections: string[]; warnings: string[] };
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { message: "Claude returned an unparseable response", raw: text.slice(0, 600) },
        { status: 502 }
      );
    }

    if (!parsed.structuredContent || typeof parsed.structuredContent !== "string") {
      return NextResponse.json(
        { message: "Claude response missing structuredContent", raw: text.slice(0, 600) },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
