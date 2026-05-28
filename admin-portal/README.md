# Sentinel — Admin Portal

TaskforceAI's internal admin console. Dark "Sentinel" UI (cyan / violet /
emerald on near-black). Built with Next.js 14 (App Router) + TypeScript +
Tailwind. Deploys to Vercel with zero config.

> This is a **standalone app**. It currently lives in the Client-Portal repo
> under `admin-portal/` only as a transport (the build sandbox can't push to
> the Admin-portal repo). To use it, move this folder to the root of
> `ChrysFernando/Admin-portal` — see "Moving to its own repo" below.

## Features

- **Admin login** — bcrypt-hashed credentials, signed HttpOnly session cookie.
- **Clients** — create client accounts with a generated/typed password; the
  password is shown (reveal + copy) in the Clients tab so you can hand it over.
- **Agents** — per client; assign a **salesperson** and a **commission %** to
  each agent, and log sales against it.
- **Salespeople** — manage the team; see sales + commission per person.
- **Reports** — per-salesperson report: every agent/client they're attributed
  to, sales generated, rate, and commission earned, with totals.
- **No hardcoded data** — everything is created through the UI and persisted in
  the store.

## Run locally

```bash
cd admin-portal
npm install
cp .env.example .env.local   # set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_SESSION_SECRET
npm run dev
```

First boot seeds an admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Sign in at
`/login`.

## Environment

| Var                    | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `ADMIN_EMAIL`          | Seed admin email (first boot only)                         |
| `ADMIN_PASSWORD`       | Seed admin password (first boot only)                      |
| `ADMIN_SESSION_SECRET` | Secret for signing session cookies (use a long random str) |
| `ADMIN_DATA_FILE`      | Path to the JSON store (optional)                          |
| `DATABASE_URL`         | Reserved for the Postgres backend (see below)              |

## Data & persistence

Data is stored as a JSON document via `lib/store.ts`. The default path is the
OS temp dir, which is **ephemeral on Vercel serverless** — fine for a demo, but
it resets on redeploys/cold starts.

For production, point `ADMIN_DATA_FILE` at a mounted volume, **or** implement
the Postgres backend: `lib/store.ts` exposes a small set of functions
(`listClients`, `createClient`, `createAgent`, `updateAgent`, `createSale`, …)
that a `pg`/Prisma implementation can replace 1:1 behind the same signatures.
Add `DATABASE_URL` and swap the read/write internals — callers don't change.

## Moving to its own repo

```bash
# from a clone of ChrysFernando/Admin-portal
cp -r /path/to/Client-Portal/admin-portal/* .
cp /path/to/Client-Portal/admin-portal/.gitignore .
cp /path/to/Client-Portal/admin-portal/.env.example .
git add -A && git commit -m "Add Sentinel admin portal" && git push
```

Then import the repo in Vercel and set the env vars above. Every push
auto-deploys.

## Security notes

- Client passwords are stored in plaintext **on purpose** so the admin can
  re-display them. This is an internal admin tool. If you'd rather not store
  them, switch to "show once at creation" and keep only the bcrypt hash
  (`passwordHash` is already stored for auth).
- Set a strong `ADMIN_SESSION_SECRET` and rotate the seed admin password.
