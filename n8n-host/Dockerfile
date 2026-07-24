# Thin wrapper around the official n8n image.
#
# Why this exists: Render auto-injects RENDER_EXTERNAL_HOSTNAME and
# RENDER_EXTERNAL_URL for every web service, with no setup needed -- but
# n8n itself doesn't know those variable names, it wants N8N_HOST,
# N8N_EDITOR_BASE_URL, and WEBHOOK_URL. render.yaml can't reference one
# env var's value from another, so a wrapper entrypoint is the smallest
# way to bridge the two: read Render's values at container start, export
# them under n8n's expected names, then hand off to n8n's own
# entrypoint unchanged. This works on every deploy AND every redeploy,
# even if the service's URL ever changes -- not just a one-time fix.
#
# CRM_WORKER_BASE_URL is deliberately NOT handled here -- it points at a
# separate Cloudflare Workers deployment that Render has no visibility
# into, so it has no equivalent auto-injected value to read. That one
# stays a manual paste, documented in this directory's README.md.

# Pinned rather than :latest -- n8n v2.0 (released 2026) replaced the
# Activate/Deactivate toggle with Publish/Unpublish and changed several
# security defaults (OAuth callback auth, env-var access in Code nodes).
# This repo's SETUP.md and workflow.json assume v2.0+ behavior. Bump
# deliberately and re-test rather than floating on :latest.
FROM n8nio/n8n:2.28.5

USER root
COPY render-entrypoint.sh /render-entrypoint.sh
RUN chmod +x /render-entrypoint.sh
USER node

ENTRYPOINT ["tini", "--", "/render-entrypoint.sh"]
