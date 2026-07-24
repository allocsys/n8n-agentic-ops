# crm-worker

A minimal, zero-touch Cloudflare Worker that stands in as the CRM backend
for the `workflow.json` in this repo — a real, live HTTP API for the
"CRM Lookup" tool and "Create CRM Ticket" node to call, instead of the
`api.example-crm.com` placeholder.

## Dashboard

`GET /` serves a self-contained HTML dashboard (dark-themed, no build step,
no JS framework) rendered server-side straight from the D1 tables: contact
count, ticket count, open-ticket count, a priority breakdown, and full
tables of recent tickets and contacts. Useful for eyeballing that the n8n
workflow is actually landing real rows — no separate BI tool or DB client
needed, just open the deployed URL in a browser.

```
https://n8n-crm-worker.<your-subdomain>.workers.dev/
```

Note: it's gated by the same `authOk` check as the API routes, so if you set
a `CRM_TOKEN` secret, the dashboard will also require a `Bearer` header —
you won't be able to just open it in a browser tab anymore.

## Endpoints

- `GET /v1/contacts/lookup?email=...` — look up a contact by email.
  Returns `{ found: false, email }` if unknown, or the contact row if found.
- `POST /v1/tickets` — create a ticket.
  JSON body: `{ "email": "...", "subject": "...", "summary": "...", "priority": "urgent" }`
- `GET /v1/tickets?email=...` — list tickets (all, or filtered by email) —
  handy for verifying a test run actually created a ticket.
- Optional auth: if a `CRM_TOKEN` secret is set, all requests require
  `Authorization: Bearer <token>`. With no secret set, auth is open (fine
  for a demo deploy, not for a real client's data).

## Setup (zero-touch)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/allocsys/n8n-agentic-ops)

One click deploys this Worker straight to your own Cloudflare account — no
Cloudflare dashboard clicking, no CLI. It uses the repo-root `wrangler.toml`
automatically (see below for why it lives there), and D1 auto-provisions on
first request same as the manual path, so there's nothing else to configure
before it's live. Once deployed, copy the `*.workers.dev` URL Cloudflare
gives you into n8n's `CRM_WORKER_BASE_URL` variable.

Prefer to do it by hand, or the button doesn't work for your setup? Import
this repo into the Cloudflare dashboard instead (Workers & Pages → Create →
Import a repository) and deploy — no root directory override needed, since
the config lives at the repo root (`/wrangler.toml`, not
`crm-worker/wrangler.toml`) specifically so Cloudflare finds it
automatically. No manual D1 setup needed either:

- The root `wrangler.toml` omits `database_id`, so Wrangler auto-provisions
  a new D1 database (`n8n-crm-worker-db`) and binds it as `DB` on first
  deploy.
- The Worker creates its own `contacts`/`tickets` tables and seeds two
  sample contacts on first request (see `ensureSchema()` in `src/index.js`).

From the CLI instead:

```bash
cd crm-worker
npm install

# (optional) require an API token
npx wrangler secret put CRM_TOKEN

npm run deploy
```

## Usage

```bash
# look up a seeded sample contact
curl "https://n8n-crm-worker.<your-subdomain>.workers.dev/v1/contacts/lookup?email=demo.customer@example.com"

# create a ticket
curl -X POST https://n8n-crm-worker.<your-subdomain>.workers.dev/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{"email":"angry.customer@example.com","subject":"Payment failed","summary":"Card declined twice","priority":"urgent"}'

# verify it landed
curl "https://n8n-crm-worker.<your-subdomain>.workers.dev/v1/tickets?email=angry.customer@example.com"
```

`workflow.json`'s CRM nodes read the URL from a single n8n environment
variable (`CRM_WORKER_BASE_URL`) instead of a hardcoded address, so you only
set it in one place (n8n → Settings → Variables, or your `.env` if
self-hosted) rather than editing multiple nodes.

## Local development

```bash
cd crm-worker
npm run db:migrate:local
npm run dev
```
