# Design notes

## 1. Process analysis before building

Before touching n8n, the underlying process is: someone reads every inbound
email, decides what kind of request it is, checks if the sender is a known
customer, answers routine questions, and escalates the rest. That's four
repeatable decisions (classify → check CRM → answer-or-not → log), which is
what made it a good candidate for automation rather than a case where "just
add an AI" would help. Anything genuinely ambiguous (angry customer, refund
disputes, security reports) is deliberately kept as a human task — the
workflow's job is to remove the manual triage step, not the human judgment
step.

## 2. Prompt design

The system prompt is written as an ordered checklist (classify → tool-check
→ decide → draft-or-not) rather than a vague persona description, because
ordered steps are what made the model reliably call the KB/CRM tools
*before* answering instead of skipping straight to a guessed reply. The
explicit instruction "never invent policy details" plus grounding tools is
the main lever against hallucinated pricing/policy answers.

The urgent-priority carve-out ("do NOT draft a reply yourself") is in the
prompt, not left to a downstream filter, because relying on a
switch-node to catch a bad draft after the fact still means the draft
exists — the safer point to stop the agent is before generation.

## 3. Memory

`memoryBufferWindow` keyed on sender email, window of 10 turns. A simple
buffer (not a full vector-memory) was the right call here: this is a
support inbox, not a research assistant — recent turns with the same
person are what matters, not fuzzy recall across the whole customer base.

## 4. RAG

The KB tool is scoped narrowly (`search_company_kb`, top-k 4) and described
to the agent as something to check *before* answering factual questions —
the tool description itself is the RAG-usage instruction, since the agent
decides when to call it.

## 5. Testing & debugging approach

- Ran representative sample emails (a billing question, a spam email, an
  angry cancellation request, a first-time inquiry) through the agent node
  in isolation (n8n's "Test step" on the AI Agent) before wiring the
  Sheets/CRM/LINE branches, to check the structured output matched schema
  every time.
- Checked the urgent branch specifically for false negatives — an angry
  email classified as "standard" is the failure mode that matters most,
  so that path got the most manual test cases.
- Used n8n's execution log / pinned data to replay a specific past email
  through the workflow after editing the prompt, instead of waiting for a
  new live email each time.

## 6. Handing this off to a non-technical team

- The Sheet is the single place ops needs to check daily — it has
  everything (category, priority, summary, human-needed flag) without
  needing to open n8n at all.
- The system prompt and JSON schema are the two things to touch if
  behavior needs to change (e.g. add a new category) — documented in the
  README so a future editor doesn't need to trace the whole graph to find
  them.
