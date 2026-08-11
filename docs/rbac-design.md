# Client-side RBAC — design & DB-integration contract

Status: **proposal for alignment** (Chanya ↔ Oshadi). This is the shared contract
for client-portal users, roles, sessions, and permissions. Nothing here should be
implemented on either side until both agree, because it changes the client
login/session that both halves depend on.

## Goal

A client (company) has **many users**, each logging into the client portal with
their own credentials and seeing only what they're permitted to. The first user
(created when a client is onboarded from the admin portal) is an **admin/owner**;
that admin can create more users and toggle each one's feature access.

## Model (agreed shape)

- **`sentinel_client`** — the account for a business/property. Unchanged. Its
  `allowed_features` CSV is the **ceiling**: the max features anyone in that
  company can be granted (their plan).
- **`sentinel_client_user`** — every person who logs in. **One unified table** —
  the admin/owner is just a row with `is_admin = true`. No separate admins table.

### `sentinel_client_user` schema (additive, never alters existing tables)

```
id               text  PRIMARY KEY            -- "cusr_" + random
client_id        text  NOT NULL               -- FK → sentinel_client.id
email            text  NOT NULL               -- unique per client (see index)
name             text
password_hash    text  NOT NULL DEFAULT ''    -- scrypt via lib/passwords; '' until set
is_admin         boolean NOT NULL DEFAULT false  -- can manage users + toggle features
allowed_features text  NOT NULL DEFAULT ''    -- CSV subset of the company's features
status           text  NOT NULL DEFAULT 'invited'  -- 'invited' | 'active' | 'disabled'
created_by       text                          -- the user id who created this row
created_at       timestamptz NOT NULL DEFAULT now()
last_login_at    timestamptz
```
Indexes: unique `(client_id, lower(email))`; index on `client_id`.

### Permissions

- `is_admin = true` → may manage users (create / edit / disable) **and** always has
  the full company feature set. Only admins reach the Team page + user APIs.
- `allowed_features` → which portal tabs a non-admin sees. **Effective features =
  `parse(sentinel_client.allowed_features) ∩ parse(user.allowed_features)`** —
  a user can never exceed the company's plan, no matter what's stored.
- No fixed role templates: an "owner" and an "admin" are the same capability
  (`is_admin`). An admin can create another admin.

## Session contract (the part both halves MUST share)

The client session cookie today carries only `clientId`. New shape:

- **User token** subject = `u:<userId>:<clientId>` (both ids embedded, so
  `getClientSession()` stays **synchronous** — no DB call to resolve the client).
- **Legacy token** subject = `<clientId>` (old company login) still verifies, so
  in-flight sessions and any not-yet-migrated client keep working.
- `getClientSession()` returns `{ clientId: string; userId: string | null }`.
  Every existing `session.clientId` reader keeps working unchanged.
- `getCurrentClientUser()` (async, new) loads the `sentinel_client_user` row for
  permission checks (`is_admin`, effective features, status).

**Login** (`POST /api/auth/client/login`): look up `sentinel_client_user` by
email first → verify password → issue a **user token**. (Fallback to the legacy
`sentinel_client` login stays until every client has users, so nothing breaks.)

## What each side owns

**Chanya (this PR):**
- `sentinel_client_user` table + data layer (`lib/clientUsers.ts`).
- Session/login extension (`lib/clientAuth.ts`, client login route) — back-compat.
- Permission helpers (`lib/clientPermissions.ts`): `getCurrentClientUser`,
  `requireClientAdmin`, effective-feature resolution.
- Admin-gated user-management API (`/api/client-users`) + the **Team** UI where an
  admin creates users, toggles features, sets admin, disables.

**Oshadi (to align):**
- When a client is created from the admin portal, insert the **first
  `sentinel_client_user`** (the owner): `is_admin = true`, `allowed_features = ''`
  (= all), `status = 'invited'`.
- Point the **set-password / invite link** at that `sentinel_client_user` row
  (extend `sentinel_client_invite_token` to reference `client_user_id`), so the
  owner sets their own password and logs in as a user.
- The "create client" welcome-email option is the owner's invite.

## Security invariants (enforced server-side, every route)

1. Tenant scoping: a user may only read/manage users where `client_id` = the
   caller's `client_id`. `client_id` comes from the session, never the request body.
2. No privilege escalation: only `is_admin` users hit management APIs; effective
   features are always intersected with the company ceiling; a user can't grant
   what the plan lacks.
3. Passwords only ever via `lib/passwords` (scrypt) or the invite/set-password
   token flow — never emailed, never logged.
4. Reuses the shipped hardening: signed cookies, 24h expiry, login rate-limiting,
   `apiGuard` tenant checks.
5. Every create / role-change / disable is audit-logged.

## Open questions for the two of us
- Email uniqueness: per-company (proposed) vs global.
- Do we retire the company-level `sentinel_client` password login entirely once
  every client has a user, or keep it as a break-glass? (Proposed: migrate then retire.)
- Per-agent scoping (limit a user to specific agents) — v1 or later? (Proposed: later.)
