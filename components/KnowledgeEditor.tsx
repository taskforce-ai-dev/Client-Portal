"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Check,
  CloudOff,
  Eye,
  FileText,
  Github,
  Lock,
  Loader2,
  Pencil,
  Save,
  TriangleAlert,
  Upload,
} from "lucide-react";
import clsx from "clsx";

type Imported = { name: string; at: number };

export default function KnowledgeEditor({
  endpoint = "/api/kb",
  allowUpload = true,
  readOnly = false,
}: {
  endpoint?: string;
  allowUpload?: boolean;
  readOnly?: boolean;
} = {}) {
  const [content, setContent] = useState("");
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"github" | "local">("local");
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [imported, setImported] = useState<Imported[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `Failed to load (${r.status})`);
        return d;
      })
      .then((d) => {
        if (!active) return;
        setContent(d.content ?? "");
        setConfigured(!!d.configured);
        setSource(allowUpload ? (d.source ?? "local") : "local");
        setTarget(d.target ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, allowUpload]);

  const save = useCallback(async () => {
    if (readOnly) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || d.message || `Save failed (${res.status})`);
      setConfigured(!!d.configured);
      if (allowUpload) setSource(d.source ?? source);
      setDirty(false);
      setLastSaved(new Date());
      setStatus(d.source === "github" ? "Committed to the agent repo" : allowUpload ? "Saved" : "Saved & synced to client portal");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [content, source, endpoint, allowUpload]);

  useEffect(() => {
    if (readOnly) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, save]);

  async function uploadFile(file: File) {
    if (readOnly) return;
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/kb/upload`, {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Upload failed (${res.status})`);
      // The service appends + persists, returning the full updated content.
      setContent(d.content ?? `${content}\n\n${d.markdown ?? ""}`);
      setImported((s) => [{ name: file.name, at: Date.now() }, ...s]);
      setDirty(false);
      setLastSaved(new Date());
      setStatus(`Converted ${file.name} → markdown`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const previewHtml = useMemo(() => {
    if (typeof window === "undefined") return "";
    const raw = marked.parse(content || "_Nothing here yet._", { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.06] ring-1 ring-white/10 text-xs text-slate-400" title="Only admins can edit">
              <Lock className="w-3 h-3" /> Read only
            </span>
          ) : !allowUpload ? (
            <span className="pill-emerald" title="Saved to the database and shown in the client portal">
              <Check className="w-3 h-3" /> Synced with client portal
            </span>
          ) : source === "github" ? (
            <span className="pill-emerald" title={target ? `Synced with ${target}` : "Synced with the agent repo"}>
              <Github className="w-3 h-3" /> Synced to agent repo
            </span>
          ) : (
            <span className="pill-amber" title="Saved to a local draft. Set KB_GITHUB_TOKEN and KB_GITHUB_REPO to sync with the agent's source.">
              <CloudOff className="w-3 h-3" /> Local draft
            </span>
          )}
          {target && (
            <span className="hidden lg:inline text-xs text-slate-500 font-mono">{target}</span>
          )}
          {lastSaved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Check className="w-3 h-3 text-emerald-400" /> Saved{" "}
              {lastSaved.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {!readOnly && dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-white/[0.04] ring-1 ring-white/10 p-0.5">
            {!readOnly && <TabButton active={tab === "edit"} onClick={() => setTab("edit")} icon={Pencil} label="Edit" />}
            <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye} label="Preview" />
          </div>
          {!readOnly && allowUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
              />
              <button
                className="btn-ghost"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Converting…" : "Upload PDF"}
              </button>
            </>
          )}
          {!readOnly && <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>}
        </div>
      </div>

      {error && (
        <div className="card p-3 border border-rose-500/20 bg-rose-500/[0.05] flex items-start gap-2.5">
          <TriangleAlert className="w-4 h-4 text-rose-300 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-200/90 font-mono break-all">{error}</div>
        </div>
      )}
      {status && !error && (
        <div className="text-xs text-emerald-300 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> {status}
        </div>
      )}

      <div
        className={clsx(
          "card relative overflow-hidden transition",
          dragging && "ring-2 ring-accent-400/50"
        )}
        onDragOver={(e) => {
          if (!allowUpload || readOnly) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!allowUpload || readOnly) return;
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) uploadFile(f);
        }}
      >
        {loading ? (
          <div className="h-[460px] grid place-items-center text-slate-500 text-sm">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading knowledge base…
            </span>
          </div>
        ) : tab === "edit" && !readOnly ? (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
              setStatus(null);
            }}
            spellCheck
            placeholder="Write what Kavya should know — pricing, policies, FAQs… Markdown supported."
            className="w-full h-[460px] resize-y bg-transparent p-5 text-sm leading-relaxed text-slate-200 font-mono outline-none placeholder:text-slate-600"
          />
        ) : (
          <div
            className="kb-prose h-[460px] overflow-y-auto p-6 text-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink-950/60 text-accent-200 text-sm font-medium">
            Drop PDF to convert & import
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{content.length.toLocaleString()} characters · Markdown</span>
        {readOnly ? <span>Contact your admin to make changes</span> : <span>Tip: ⌘/Ctrl + S to save</span>}
      </div>

      {imported.length > 0 && (
        <div className="card p-4">
          <div className="text-xs stat-label mb-2">Imported this session</div>
          <ul className="space-y-1.5">
            {imported.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <FileText className="w-3.5 h-3.5 text-accent-300" />
                {f.name}
                <span className="text-xs text-slate-500">
                  · {new Date(f.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
        active ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
