"use client";

import { useEffect } from "react";

// Triggers the browser print dialog once the page has rendered. The user
// chooses "Save as PDF" to download the report.
export default function PrintOnReady() {
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.print(); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
