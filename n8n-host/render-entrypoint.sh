#!/bin/sh
# Bridges Render's auto-injected service-URL env vars to the names n8n
# itself reads. Render sets RENDER_EXTERNAL_HOSTNAME and
# RENDER_EXTERNAL_URL automatically for every web service -- see
# https://render.com/docs/environment-variables -- no dashboard setup
# required. n8n doesn't know those names, so translate them here, once,
# at container start, instead of asking a human to paste the URL back
# into the dashboard after the first deploy.
#
# Each var is only set if not already provided explicitly (e.g. someone
# overrides N8N_EDITOR_BASE_URL by hand in the Render dashboard), so a
# manual override always wins over the derived value.
set -e

if [ -n "$RENDER_EXTERNAL_HOSTNAME" ]; then
  : "${N8N_HOST:=$RENDER_EXTERNAL_HOSTNAME}"
  export N8N_HOST
fi

if [ -n "$RENDER_EXTERNAL_URL" ]; then
  : "${N8N_EDITOR_BASE_URL:=$RENDER_EXTERNAL_URL}"
  : "${WEBHOOK_URL:=$RENDER_EXTERNAL_URL}"
  export N8N_EDITOR_BASE_URL WEBHOOK_URL
fi

# Hand off to n8n's own entrypoint, unchanged, with whatever args/CMD
# Render passes through.
exec /docker-entrypoint.sh "$@"
