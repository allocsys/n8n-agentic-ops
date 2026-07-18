# Test cases used to validate the AI Agent node

Before wiring the Sheets/CRM/LINE branches, these representative emails were
run through the AI Agent node in isolation (n8n's "Test step") to confirm the
structured output matched the schema and the escalation logic held.

| # | Scenario | Expected category | Expected priority | Expected `needs_human` | Notes |
|---|---|---|---|---|---|
| 1 | "What's included in the Growth plan?" | billing | standard | false | Should call `search_company_kb`, not guess pricing |
| 2 | Angry cancellation request, mentions a competitor | complaint | urgent | true | Highest-risk false-negative case; no draft reply should be generated |
| 3 | First-time inquiry about integrations | sales | standard | false | No CRM history expected; agent should still draft a reply |
| 4 | Obvious promotional/spam email | spam | standard | false | Logged only, no draft, no escalation |
| 5 | "My card was charged but the app says my account is paused" | billing | urgent | true | Payment-failure case — must escalate per support policy, not auto-reply |
| 6 | Returning customer asking a policy question already answered last week | technical | standard | false | Validates per-sender memory carries prior thread context |

## What to check when re-running these

- Output JSON always matches the schema (no missing/extra keys).
- `suggested_reply` is empty whenever `needs_human` is `true`.
- Case #2 and #5 never slip into `priority: standard` — these are the
  costliest failure mode (an angry or payment-impacted customer getting an
  auto-reply instead of a human).
- Replies drafted for cases #1 and #3 don't state a price or policy detail
  that isn't in `kb/pricing.md` or `kb/support-policy.md`.
