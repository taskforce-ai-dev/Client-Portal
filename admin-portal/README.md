# Sentinel Admin Portal (separate Vercel deployment)

This folder is the **exact** Sentinel super-admin UI from the reference
(`agent-dashboard-ten-zeta.vercel.app/admin/`) — the unmodified compiled
bundle. It is meant to be deployed as its **own Vercel project**, separate
from the client portal, while living in this repo for transport.

## Contents

```
admin-portal/
  vercel.json        static config + rewrites (/ and /admin → console)
  admin/
    index.html       Sentinel console (bundle, <base href="/admin/">)
    asset_*.js/.bin   bundle assets (JS app + woff2 fonts)
    login.html        admin sign-in page
```

It's a 100% static SPA (in-browser Babel). All data comes from one call to
`/api/admin/sentinel-bundle`; until that backend exists the console renders
its **empty state** (exact layout, no data) and the login posts to
`/api/auth/admin/login`.

## Deploy as a separate Vercel project

1. Vercel → **Add New… → Project** → import **ChrysFernando/Client-Portal**.
2. **Root Directory:** set to `admin-portal`.
3. **Framework Preset:** Other (it's static — no build step).
4. Deploy. You get a separate URL, e.g. `sentinel-admin-xxxx.vercel.app`,
   that auto-deploys on every push to this repo.

The console will be at `/` (and `/admin`); login at `/admin/login`.

## Next step

Implement the backend the UI expects — primarily:

- `POST /api/auth/admin/login` → set session cookie
- `GET  /api/admin/sentinel-bundle` → the aggregated data the console renders
- plus the mutation endpoints (new client, suspend/activate, etc.)

Do NOT edit the files under `admin/` (they're the verbatim reference build);
add the backend alongside instead.
