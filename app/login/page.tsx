import { Suspense } from "react";
import LoginForm from "./LoginForm";

// Server Component shell — no "use client" here. The Suspense boundary is
// required by Next.js 14 to host useSearchParams() inside the LoginForm
// child without breaking static prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
