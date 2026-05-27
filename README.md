# Portal

TaskforceAI Client Portal — a dark, Aether-style dashboard where clients can sign
in and view the AI agents TaskforceAI has provisioned for them.

## Tech

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS, lucide-react, Recharts
- Twilio REST API (server-side) for live call data
- Deployed on Vercel

## Routes

| Path                              | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `/login`                          | Sign in (demo creds pre-filled)                  |
| `/select`                         | Pick an agent in the workspace                   |
| `/agents/[id]`                    | Overview — KPIs, calls today, recent calls       |
| `/agents/[id]/calls`              | Full call log                                    |
| `/agents/[id]/knowledge`          | Knowledge base sources                           |
| `/agents/[id]/analytics`          | Calls per day / hour, outcomes, peak hour        |
| `/agents/[id]/billing`            | Minutes used, Twilio cost, invoice history       |
| `/agents/[id]/settings`           | Voice / greeting / behaviour                     |

Agents are provisioned by TaskforceAI — there is no client-side "Create agent"
flow. The seed workspace is **Tree House Chalets** with one agent: **Kavya**
(Booking Agent).

## Live data via Twilio

Pages that show calls or usage fetch directly from Twilio on the server. Set
these environment variables in Vercel → Project → Settings → Environment
Variables:

```
TWILIO_ACCOUNT_SID                  # master account SID
TWILIO_AUTH_TOKEN                   # master account auth token
TWILIO_TREEHOUSE_SUBACCOUNT_SID     # subaccount SID for Tree House Chalets
```

When any variable is missing, pages fall back to demo data and show a
`Demo data` pill instead of `Live · Twilio`, so the UI keeps working in
preview environments.

### What we pull from Twilio

- `GET /2010-04-01/Accounts/{Subaccount}/Calls.json` — call log, durations,
  status, direction. Mapped to outcome pills and used for the Overview,
  Analytics and Call Logs pages.
- `GET /2010-04-01/Accounts/{Subaccount}/Usage/Records/ThisMonth.json` —
  this-month minutes and price for the Billing page.

Pages revalidate every 30–60 seconds, so live numbers stay fresh without
hammering the API.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real Twilio values for live data
npm run dev
```
