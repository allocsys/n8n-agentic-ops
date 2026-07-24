# Setup Guide: Plug-and-Play Deploy

This is the step-by-step path to get the workflow running on your own
accounts, using n8n's native "Connect" OAuth buttons — no pasting raw
API keys for Gmail, Drive, or Sheets. It assumes you've already used the
one-click deploy buttons in the main [README](README.md):

1. **Deploy to Cloudflare Workers** ([crm-worker/README.md](crm-worker/README.md)) → gives you a CRM API URL like `https://your-worker.workers.dev`
2. **Deploy to Render** ([n8n-host/README.md](n8n-host/README.md)) → gives you your own n8n instance URL

If you haven't done those yet, do them first — everything below assumes
you have both URLs in hand.

## Required setup (Gmail triage, single LLM provider)

This is the minimum path: email in, AI triage, replies drafted, logged to
a sheet. No Telegram, WhatsApp, Drive, or multi-provider fallback.

1. **Open your n8n instance** at the Render URL from step 2 above and log
   in (the Render Blueprint auto-generates the basic-auth password — check
   your Render service's environment variables if you don't have it).
2. **Set the CRM Worker URL.** This has to be a real container
   environment variable, not n8n's in-app Settings → Variables (the
   workflow reads it via `$env`, which only sees the container's actual
   env vars). In the Render dashboard → your n8n service → Environment,
   find `CRM_WORKER_BASE_URL` (already listed there as a placeholder from
   `render.yaml`) and replace it with your `*.workers.dev` URL from step
   1, then save (Render redeploys automatically).
3. **Import the workflow.** In n8n: Workflows → Import from File →
   select `workflow.json` from this repo.
4. **Connect Gmail.** Click the **Gmail Trigger** node → Credential →
   *Create New* → n8n opens Google's OAuth consent screen → sign in and
   grant access → done. No client ID/secret to paste; n8n's hosted OAuth
   handles it. Repeat the same "Create New → Connect" flow on the
   **Create Gmail Draft Reply** node (or just select the credential you
   just created).
5. **Connect Google Sheets.** Same OAuth flow on the **Log to Ops Sheet**
   node. Create a spreadsheet first with two tabs named `Log` and
   `Attachments` (see the main README for the columns each tab needs),
   then set `documentId` on both Sheets nodes to that spreadsheet's ID
   (from its URL).
6. **Add your OpenAI credential.** Click the **OpenAI Chat Model** node →
   Credential → *Create New* → paste your OpenAI API key. Do the same on
   the **Embeddings (OpenAI)** node (same credential, reuse it).
7. **Set up the CRM + KB tools.** The **CRM Lookup (tool)** node needs a
   generic HTTP Header Auth credential matching your Worker's auth (see
   crm-worker/README.md). The **Company KB Search (RAG tool)** node needs
   a Qdrant credential — see the RAG section of the main README if you
   don't already have a Qdrant instance.
8. **Activate the workflow.** Toggle it on (top-right in the n8n editor).

That's it — Gmail messages now get triaged, drafted, and logged, using a
single LLM provider, with no Telegram/WhatsApp/Drive accounts required.

## Optional add-ons

Each of these turns on independently — set the credential/env var and it
starts working, with no workflow-graph edits needed.

### Google Drive (email attachment uploads)
- Connect a Google Drive OAuth2 credential on the **Upload Attachment to
  Drive** node (same "Create New" OAuth flow as Gmail/Sheets).
- Set the `GOOGLE_DRIVE_FOLDER_ID` environment variable to the Drive
  folder you want uploads to land in.
- Leave `GOOGLE_DRIVE_FOLDER_ID` unset and this entire branch is skipped —
  no Drive account needed.

### Extra LLM providers (multi-provider fallback)
- The default setup above uses OpenAI only. To add Google Gemini and/or
  Anthropic Claude as automatic fallbacks (tried in order if OpenAI errors
  or rate-limits):
  - Re-enable the **Google Gemini Chat Model** and/or **Anthropic Chat
    Model** nodes (they ship disabled) and attach real credentials to each.
  - No connection changes needed — they're already wired into the AI
    Agent's language-model input, just switched off.

### Ops alerts on urgent messages (LINE / Telegram / WhatsApp)
Each channel has its own "Configured?" gate — set the matching env var
and that channel's ops alert turns on:
- **LINE**: set `LINE_OPS_GROUP_ID`, attach an HTTP Header Auth credential
  with your LINE Channel Access Token to the **Notify Ops Team (LINE)**
  node.
- **Telegram**: set `TELEGRAM_OPS_CHAT_ID`, attach a Telegram Bot API
  credential (see below) to the **Notify Ops Team (Telegram)** node.
- **WhatsApp**: set `WHATSAPP_OPS_NUMBER`, attach a WhatsApp Business
  Cloud API credential (see below) to the **Notify Ops Team (WhatsApp)**
  node.

Leave any of these env vars unset and that alert is simply never sent —
no account needed for the ones you skip.

### Telegram / WhatsApp as inbound channels
Unlike everything else above, these two can't be turned on by just setting
an env var — n8n checks a trigger node's credential when the workflow is
activated, before any if-logic runs, so an unconfigured trigger would
block activation entirely. That's why both ship hard-disabled. To enable:

- **Telegram**: create a bot via [@BotFather](https://t.me/BotFather) on
  Telegram (`/newbot`, get the token), add it as a Telegram Bot API
  credential in n8n, attach it to the **Telegram Trigger** node, and
  re-enable that node.
- **WhatsApp**: requires a Meta developer account and a WhatsApp Business
  Cloud API app (Meta's business-verification process — this is the one
  step in this whole guide that isn't a quick OAuth click). Once you have
  the API credentials, attach them to the **WhatsApp Trigger** node and
  re-enable it.

Both are genuinely optional — the workflow runs fine on Gmail alone.

## What's still manual

Everything above uses either a one-click deploy button or n8n's native
OAuth "Connect" flow, except:

- Pasting the CRM Worker URL into `CRM_WORKER_BASE_URL` (one paste, done
  once)
- Telegram bot token / WhatsApp Business verification, if you want those
  inbound channels — these platforms don't offer real OAuth "Sign in"
  buttons, so there's no way to automate this part away
