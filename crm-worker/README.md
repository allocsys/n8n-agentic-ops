# crm-worker

A minimal, zero-touch Cloudflare Worker that stands in as the CRM backend
for the `workflow.json` in this repo — a real, live HTTP API for the
"CRM Lookup" tool and "Create CRM Ticket" node to call, instead of the
`api.example-crm.com` placeholder.

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

Import this repo into the Cloudflare dashboard (Workers & Pages → Create →
Import a repository), set the **root directory** to `crm-worker/`, and
deploy. No manual D1 setup needed:

- `wrangler.toml` omits `database_id`, so Wrangler auto-provisions a new D1
  database (`n8n-crm-worker-db`) and binds it as `DB` on first deploy.
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

## Automatic deploy + URL capture (GitHub Actions)

`.github/workflows/deploy-crm-worker.yml` deploys this Worker automatically
on every push to `crm-worker/**` (or on manual trigger) and writes the real
living URL to `crm-worker/DEPLOYED_URL.txt` in the same commit run — so you
never have to hunt for it in the Cloudflare dashboard.

One-time setup required (can't be automated further without your
credentials):
1. In the repo's Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN` — a Workers-edit-scoped API token
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID
2. Push to `main` (or run the workflow manually from the Actions tab).
3. Check `crm-worker/DEPLOYED_URL.txt` for the live URL, then paste it into
   `CRM_WORKER_BASE_URL` in n8n.

Everything after step 1 re-runs automatically on future pushes — the URL
file stays in sync with whatever's actually deployed.

## Local development

```bash
cd crm-worker
npm run db:migrate:local
npm run dev
```
