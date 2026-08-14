"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ImageUp, Trash2, Check } from "lucide-react";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB source; we downscale before upload

// Downscale a raster image to <= maxPx on its longest side and return a PNG
// data URL, keeping the stored logo small. SVGs are returned as-is (already
// tiny and resolution-independent).
function toDataUrl(file: File, maxPx = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      const src = String(reader.result || "");
      if (file.type === "image/svg+xml") return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error("That image couldn't be loaded"));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoUploader({ initialLogo, company }: { initialLogo: string | null; company: string }) {
  const router = useRouter();
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [pending, setPending] = useState<string | null>(null); // staged, not yet saved
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = pending ?? logo;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setMsg(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      return setMsg({ kind: "err", text: "Use a PNG, JPG, WEBP, GIF, or SVG image." });
    }
    if (file.size > MAX_FILE_BYTES) {
      return setMsg({ kind: "err", text: "That file is too large (max 4 MB)." });
    }
    try {
      const dataUrl = await toDataUrl(file);
      setPending(dataUrl);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't process that image" });
    }
  }

  async function save() {
    if (!pending) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/client/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: pending }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't save the logo");
      setLogo(d.logoUrl);
      setPending(null);
      setMsg({ kind: "ok", text: "Logo saved." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't save the logo" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/client/logo", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't remove the logo");
      setLogo(null);
      setPending(null);
      setMsg({ kind: "ok", text: "Logo removed." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't remove the logo" });
    } finally {
      setBusy(false);
    }
  }

  const initial = (company || "?").charAt(0).toUpperCase();

  return (
    <div className="card p-4 space-y-4">
      <div>
        <div className="text-sm font-medium text-white flex items-center gap-2">
          <ImageUp className="w-4 h-4 text-accent-300" /> Company logo
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Shown across your portal. PNG, JPG, WEBP, GIF, or SVG — large images are scaled down automatically.
        </p>
      </div>

      {msg && (
        <div
          className={`text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 ring-1 ${
            msg.kind === "ok"
              ? "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20"
              : "text-rose-300 bg-rose-500/10 ring-rose-500/20"
          }`}
        >
          {msg.kind === "ok" && <Check className="w-3.5 h-3.5" />} {msg.text}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 grid place-items-center overflow-hidden shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied data URL, next/image can't optimize it
            <img src={preview} alt={`${company} logo`} className="w-full h-full object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 font-bold grid place-items-center">
              {initial}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImageUp className="w-4 h-4" /> Choose image
          </button>
          {pending && (
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save logo
            </button>
          )}
          {(logo || pending) && (
            <button
              type="button"
              className="btn-ghost !text-rose-300"
              onClick={pending ? () => setPending(null) : remove}
              disabled={busy}
              title={pending ? "Discard the selected image" : "Remove the current logo"}
            >
              <Trash2 className="w-4 h-4" /> {pending ? "Discard" : "Remove"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
