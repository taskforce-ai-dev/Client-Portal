// Shared "required secret or fail closed" helper. Centralises the contract and
// error format for env vars that must be present for the app to run securely.
//
// Callers read their secret once at module load, so a missing value throws
// while the module is being evaluated — the build/deploy fails loudly instead
// of the app starting and silently falling back to an insecure default. That
// throw-at-import behaviour is deliberate (see lib/clientAuth.ts,
// lib/adminAuth.ts, lib/passwords.ts).
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `${name} is not set. Refusing to start — this secret is required to run securely.`
    );
  }
  return v;
}
