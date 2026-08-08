# API route security audit

Go/no-go artifact for the multi-tenant hardening sprint. Every route under
`app/api/` classified as **client-data**, **admin**, **ingest**, or **public**,
with the check it performs after this PR.

- **client-data** — must verify a signed client cookie, an active account, AND
  agent ownership. Enforced via `lib/apiGuard.ts` (`requireClientSession` /
  `requireAgentOwnership`), which mirrors `app/agents/[id]/layout.tsx`.
- **ingest** — machine-to-machine; constant-time `ingest_key` compare. Contract
  **frozen** (the Dialog migration reports through these). Left untouched.
- **admin** — `isAuthed()` admin cookie. Owned by Oshadi; listed for completeness.
- **public** — no auth by design (login/logout).

## Client-data routes (this PR)

| Route | Methods | Before | After |
|---|---|---|---|
| `agents/[id]/kb` | GET | admin OR client-owner; **no status check** | admin → any; client → `requireAgentOwnership` (adds active-status check) |
| `agents/[id]/kb` | PUT | `isAuthed()` (admin only) | unchanged — admin only |
| `agents/[id]/notifications` | DELETE | session + ownership; **no status check** | `requireAgentOwnership` |
| `agents/[id]/notifications/mark-read` | POST | session + ownership; **no status check** | `requireAgentOwnership` |

Result: non-ownership now returns **403** (was 404); a disabled/suspended/deleted
account loses API access immediately instead of only being blocked at the page layer.

## Ingest routes (frozen — untouched)

| Route | Methods | Check |
|---|---|---|
| `agents/[id]/usage` | POST | constant-time `ingest_key` (x-api-key) |
| `agents/[id]/summaries` | POST | constant-time `ingest_key` (x-api-key) |
| `agents/[id]/meta-inquiries` | POST | constant-time `ingest_key` (x-api-key) |

## Auth routes

| Route | Methods | Check |
|---|---|---|
| `auth/client/login` | POST | credentials + active-status + **login rate limit** (new) |
| `auth/admin/login` | POST | credentials + **login rate limit** (new) |
| `auth/client/logout` | POST | public (clears own cookie) |
| `auth/admin/logout` | POST | public (clears own cookie) |

Rate limit: fixed-window in Postgres (`sentinel_rate_limit`), per client-IP per
scope, 10 failed attempts / 15 min → 429 with `Retry-After`. Successful logins
don't count.

## Admin routes (Oshadi's scope — verified `isAuthed()`)

All 30 routes under `app/api/admin/**` gate on `isAuthed()`:
`admins`, `admins/[id]`, `admins/[id]/password`, `agents/[id]` (+ `api-keys`,
`billing`, `conversions`, `ingest-key`, `meta-inquiries`, `notifications`,
`quota`, `summaries`, `tokens`, `twilio`, `twilio-cost`), `announcements`,
`audit`, `clients` (+ `[id]`, `[id]/agents`, `[id]/password`, `[id]/twilio`),
`kb`, `kb/extract`, `knowledge-base/structure`, `metrics`, `plans`,
`sentinel-bundle`, `settings/fx-rate`, `support/tickets`.

## Removed / flagged

| Route | Status |
|---|---|
| `kb` (GET/PUT) | **Deleted** (PR #1) — was unauthenticated, wrote to a single-tenant agent repo |
| `kb/upload` (POST) | **Flagged** in issue #7 — identical unauthenticated single-tenant GitHub-write hole; dead code; outside named scope |

## Day-3 test matrix

- [ ] Cookie forged with `sentinel-dev-secret-change-me` → rejected on pages and every client-data route.
- [ ] Client A's valid session against Client B's agent id → 403 on `kb` GET, `notifications` DELETE, `mark-read` POST.
- [ ] `GET`/`PUT /api/kb` → 404.
- [ ] Disabled client → API access lost (403) on all client-data routes.
- [ ] Repeated failed logins from one IP → 429.
