import { Suspense } from "react";
import SetPasswordForm from "./SetPasswordForm";

// Server Component shell — mirrors app/login/page.tsx. The Suspense
// boundary is required by Next.js 14 to host useSearchParams() inside the
// client form without breaking static prerender. Deliberately not gated by
// middleware.ts (client-auth.ts's territory) — a client must be able to
// reach this page while signed out, token in hand.
export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}
