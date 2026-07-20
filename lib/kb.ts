import { promises as fs } from "fs";
import os from "os";
import path from "path";

// ---------------------------------------------------------------------------
// GitHub backend — the Tree House agent's knowledge base lives in its repo at
// knowledge_docs/hotel_info.txt. We read it on load and commit changes back to
// that one file. Nothing else in the repo is touched.
// ---------------------------------------------------------------------------
const GH_TOKEN = process.env.KB_GITHUB_TOKEN;
const GH_REPO = process.env.KB_GITHUB_REPO; // e.g. "ChrysFernando/Kavya-Agent-Treehouse"
const GH_PATH = process.env.KB_GITHUB_PATH || "knowledge_docs/hotel_info.txt";
const GH_BRANCH = process.env.KB_GITHUB_BRANCH || "main";

// PDF conversion service (Python). Optional — only needed for PDF import.
const KB_API_URL = process.env.KB_API_URL;
const KB_API_KEY = process.env.KB_API_KEY;

export function isGithubConfigured() {
  return !!(GH_TOKEN && GH_REPO);
}

export function isPdfConversionConfigured() {
  return !!KB_API_URL;
}

export type KbSource = "github" | "local";

export type KbResult = {
  content: string;
  configured: boolean;
  source: KbSource;
  target?: string;
};

// ---------------------------------------------------------------------------
// GitHub Contents API helpers
// ---------------------------------------------------------------------------
function ghHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "taskforceai-client-portal",
  };
}

function ghContentsUrl() {
  const encodedPath = GH_PATH!.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${GH_REPO}/contents/${encodedPath}`;
}

function ghTarget() {
  return `${GH_REPO}:${GH_PATH}@${GH_BRANCH}`;
}

async function ghGetFile(): Promise<{ content: string; sha: string | null }> {
  const res = await fetch(`${ghContentsUrl()}?ref=${encodeURIComponent(GH_BRANCH)}`, {
    headers: ghHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) {
    return { content: "", sha: null };
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content ?? "", "base64").toString("utf8");
  return { content, sha: data.sha ?? null };
}

async function ghPutFile(content: string, message: string): Promise<void> {
  // Re-read the latest SHA right before committing to avoid stale-write 409s.
  const { sha } = await ghGetFile();
  const res = await fetch(ghContentsUrl(), {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: GH_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
}

// ---------------------------------------------------------------------------
// Local fallback (dev only) — used when GitHub isn't configured.
// ---------------------------------------------------------------------------
const localDir = path.join(os.tmpdir(), "kb-store");
function localFile() {
  return path.join(localDir, "kb.md");
}
async function readLocal(): Promise<string> {
  try {
    return await fs.readFile(localFile(), "utf8");
  } catch {
    return DEFAULT_KB;
  }
}
async function writeLocal(content: string): Promise<void> {
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(localFile(), content, "utf8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function getKbContent(): Promise<KbResult> {
  if (isGithubConfigured()) {
    const { content } = await ghGetFile();
    return { content, configured: true, source: "github", target: ghTarget() };
  }
  return { content: await readLocal(), configured: false, source: "local" };
}

export async function saveKbContent(content: string): Promise<KbResult> {
  if (isGithubConfigured()) {
    await ghPutFile(content, "chore(kb): update knowledge base from client portal");
    return { content, configured: true, source: "github", target: ghTarget() };
  }
  await writeLocal(content);
  return { content, configured: false, source: "local" };
}

export type ConvertResult = { filename: string; markdown: string };

async function convertPdf(file: File): Promise<ConvertResult> {
  const out = new FormData();
  out.append("file", file, file.name || "upload.pdf");
  const res = await fetch(`${KB_API_URL}/convert`, {
    method: "POST",
    headers: KB_API_KEY ? { Authorization: `Bearer ${KB_API_KEY}` } : {},
    body: out,
  });
  if (!res.ok) {
    throw new Error(`Converter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

// Convert a PDF, append it to the current KB, and persist via the active
// backend (GitHub when configured). Returns the full updated content.
export async function importPdf(file: File): Promise<{ filename: string; content: string }> {
  if (!isPdfConversionConfigured()) {
    throw new Error("PDF conversion service not configured — set KB_API_URL.");
  }
  const { markdown, filename } = await convertPdf(file);
  const current = (await getKbContent()).content;
  const heading = `\n\n## Imported from ${filename}\n\n`;
  const combined = current.trim()
    ? `${current.replace(/\s+$/, "")}${heading}${markdown.trim()}\n`
    : `## Imported from ${filename}\n\n${markdown.trim()}\n`;
  const saved = await saveKbContent(combined);
  return { filename, content: saved.content };
}

// Convert an uploaded file to markdown/text WITHOUT saving it anywhere.
// Text files (.md/.txt/.csv) are read directly (no external service needed);
// PDF/DOCX go through the external converter (KB_API_URL). Returns the
// extracted text so the caller can drop it into a per-agent KB editor.
export async function convertUploadedFile(file: File): Promise<{ filename: string; markdown: string }> {
  const name = (file.name || "").toLowerCase();
  const isText =
    (file.type && file.type.startsWith("text/")) ||
    /\.(md|markdown|txt|csv|text)$/.test(name);
  if (isText) {
    const text = await file.text();
    return { filename: file.name || "upload.txt", markdown: text };
  }
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (isPdf || isDocx) {
    if (!isPdfConversionConfigured()) {
      throw new Error(
        "Document conversion isn't configured (set KB_API_URL). You can upload .md or .txt files directly, or paste the text into AI Structure."
      );
    }
    const { markdown, filename } = await convertPdf(file);
    return { filename: filename || file.name || "upload", markdown };
  }
  throw new Error("Unsupported file type — upload .md, .txt, .pdf, or .docx.");
}

export const DEFAULT_KB = `# Knowledge Base

Connect the Tree House agent repo to load the live knowledge base.

Set KB_GITHUB_TOKEN and KB_GITHUB_REPO (and optionally KB_GITHUB_PATH /
KB_GITHUB_BRANCH) so this editor reads and writes
knowledge_docs/hotel_info.txt in the agent's source.

Until then, edits are kept in a local draft only.
`;
