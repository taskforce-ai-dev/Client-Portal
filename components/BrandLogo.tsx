/**
 * TaskForce AI brand lockup — the official horizontal logo (wordmark + mark).
 *
 * The source vector lives in /public/brand/ (exported from the brand PDF):
 *   - taskforce-horizontal-white.svg  → for dark surfaces (the portal)
 *   - taskforce-horizontal-color.svg  → brand purple, for light surfaces
 *   - taskforce-horizontal.svg        → currentColor, if you need it to inherit
 *
 * We render the logo in its original brand colours. To rebrand, drop a new
 * file in /public/brand and point `src` at it — one line, everywhere.
 */
export default function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const h = size === "lg" ? "h-9" : size === "sm" ? "h-6" : "h-7";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG logo; next/image adds no value for inline vectors
    <img
      src="/brand/taskforce-horizontal-color.svg"
      alt="TaskForce AI"
      className={`${h} w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
