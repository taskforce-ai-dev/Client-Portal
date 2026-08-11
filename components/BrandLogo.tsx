import { type ReactNode } from "react";

/**
 * TaskForce AI brand lockup for the client portal.
 *
 * Single source of truth for portal branding — the badge glyph and the
 * wordmark live here, so swapping in the official TaskForce AI asset later is a
 * one-file change. To use a real image instead of the inline glyph, replace the
 * <svg> with an <img src="/brand/taskforce.svg" .../> (drop the file in
 * /public/brand) and keep the same wrapper classes.
 */
export default function BrandLogo({
  size = "md",
  wordmark = true,
  glow = true,
  className = "",
}: {
  size?: "sm" | "md";
  /** Show the "TaskForce AI" text next to the mark. */
  wordmark?: boolean;
  /** Cyan glow behind the badge (used on dark hero/nav surfaces). */
  glow?: boolean;
  className?: string;
}): ReactNode {
  const box = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const glyph = size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]";
  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      role="img"
      aria-label="TaskForce AI"
    >
      <div
        className={`relative ${box} rounded-xl bg-accent-gradient grid place-items-center ${
          glow ? "shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)]" : ""
        }`}
      >
        {/* Bold "TF" monogram — dark glyph on the cyan badge. */}
        <svg viewBox="0 0 24 24" className={`${glyph} text-ink-950`} fill="currentColor" aria-hidden="true">
          <path d="M3.6 4.6h9.2v2.9H9.9V19h-3V7.5H3.6z" />
          <path d="M13.9 4.6h6.7v2.9h-4v3h3.5v2.85h-3.5V19h-2.7z" />
        </svg>
      </div>
      {wordmark && (
        <div className="font-semibold tracking-tight text-white text-[15px] leading-none">
          TaskForce<span className="text-accent-400"> AI</span>
        </div>
      )}
    </div>
  );
}
