# n8n workflows

n8n automation exports for the email pipeline. These are not run by this
Next.js app — import them into n8n directly (Workflows → Import from File).

## email-draft-agent.workflow.json

AI Email Agent: takes plain-language instructions, drafts a reply, saves it
as a **Gmail draft** (never auto-sends), and pings the requester on WhatsApp
to review/edit/send it themselves.

**Trigger** — `POST /webhook/email/draft-request`

```json
{
  "mailbox": "user@gmail.com",
  "requesterPhone": "+94778042520",
  "recipientEmail": "someone@example.com",
  "recipientName": "Jane Doe",
  "instructions": "Confirm we'll ship the order Monday and apologize for the delay.",
  "threadId": "19b981efe2ef656b",
  "originalEmail": {
    "subject": "Where's my order?",
    "from": "Jane Doe <someone@example.com>",
    "body": "..."
  }
}
```

`threadId` and `originalEmail` are optional — omit both for a new (non-reply)
email.

**Response** (once the draft is created)

```json
{
  "success": true,
  "draftId": "...",
  "webLink": "https://mail.google.com/...",
  "mailbox": "user@gmail.com",
  "recipientEmail": "someone@example.com",
  "subject": "Re: Where's my order?"
}
```

**Flow**: `Draft Request Webhook` → `cleanFields` → `Email Draft AI Agent`
(gpt-4.1-mini, structured output: `subject` / `body` / `summary`) →
`Create Gmail Draft`, which fans out to:
- `Respond to Webhook` — returns the draft info to the caller
- `prepareWhatsAppApprovalPayload` → `Send WhatsApp Draft Approval` — reuses
  the same **WhatsApp Secretary** sub-workflow as the email classifier
  workflow, sending the requester a preview + link so they can review, edit,
  and send from Gmail themselves.

### Backend dependency

`Create Gmail Draft` POSTs to the same Gmail bridge service the classifier
workflow already calls for `applyLabels` (currently an ngrok tunnel —
update the URL in that node whenever the tunnel rotates). It needs a new
route alongside `applyLabels`:

```
POST /api/gmail/createDraft
Body: { mailbox, to, threadId, subject, body }
Response: { draftId, webLink }
```

`threadId` will be an empty string for new emails — the bridge should treat
that as "create a standalone draft" rather than attaching to a thread.

### Known limitations

- `recipientEmail` must be supplied in the request — there's no
  name-to-address lookup, so the caller (portal UI, chatbot, etc.) is
  responsible for resolving who "Jane" or "the UCSC exam office" is.
- Nothing sends the email automatically. The human always sends from Gmail
  after reviewing the draft — by design, per the approval requirement.
