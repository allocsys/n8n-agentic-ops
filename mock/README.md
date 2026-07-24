# Mock mode — demo the workflow with zero credentials

This folder lets you see and run the full triage/routing logic from
`workflow.json` without signing up for n8n cloud, Gmail OAuth, Google
Sheets/Drive, a CRM sandbox, LINE, Telegram, or WhatsApp Business API.

## What's in here

- **`workflow.mock.json`** — a self-contained n8n workflow. Every node that
  would normally need a credential (Gmail/Telegram/WhatsApp triggers, the
  OpenAI/Gemini/Claude AI Agent, Google Sheets, Google Drive, the CRM HTTP
  calls, LINE/Telegram/WhatsApp notifications) is replaced with a `Manual
  Trigger`, `Set`, or `Code` node using canned data. The **branching logic
  itself is untouched** — same `Route by Category/Priority` and `Route Reply
  by Channel` switch nodes as the real workflow, so this demonstrates the
  actual decision-making, not a simplified stand-in.
- **`sample-payloads/`** — realistic trigger payloads (Gmail/Telegram/
  WhatsApp API shapes) you can paste into `workflow.json`'s real trigger
  nodes as **pinData**, so you can test the *real* node wiring (field
  extraction, expressions) offline too, before you ever connect a live
  credential.

## How to run the mock

1. Get a free local n8n instance running (no account needed):
   ```
   npx n8n
   ```
   then open `http://localhost:5678`.
2. Import `mock/workflow.mock.json` (Workflows → Import from File).
3. Click **Execute Workflow**. All three mock inbound messages (email,
   Telegram, WhatsApp) run at once — you'll see:
   - the email (double-charge complaint) routed as **urgent** → mock CRM
     ticket + mock ops notification, no reply drafted
   - the WhatsApp message (promo-link text) routed as **spam** → logged
     only
   - the Telegram message (support-hours question) routed as **standard**
     → mock reply drafted and "sent" back on Telegram
4. Click into any `Mock *` node's output to see exactly what it *would*
   have sent to the real API (request body / response shape), without
   anything having left your machine.

## What this proves vs. what it doesn't

Proves: the full multi-channel triage → classify → route →
reply-or-escalate logic works end-to-end, including the urgent/spam/
standard branching and the per-channel reply routing.

Doesn't prove: that the real Gmail/Telegram/WhatsApp trigger payload
shapes are parsed correctly (the WhatsApp one in particular is unverified
— see the note in `workflow.json`), that the AI Agent's actual prompt/KB
grounding produces good replies, or that the live CRM Worker deploy
succeeds. Those require real credentials and are tracked as the next
steps in the project plan.
