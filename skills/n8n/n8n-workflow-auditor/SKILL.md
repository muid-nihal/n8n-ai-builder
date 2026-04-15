---
name: n8n-workflow-auditor
description: >
  Design audit framework for n8n workflows. Use when reviewing a workflow for
  quality, best practices, maintainability, or before making it production-ready.
  Different from n8n-validator (which checks technical correctness) — this reviews
  DESIGN: naming conventions, error handling coverage, retry logic, webhook security,
  performance patterns, code quality in Code nodes, and documentation standards.
  Trigger for: "audit this workflow", "is this workflow production-ready",
  "review the design of [workflow]", "what's wrong with this workflow's structure",
  "how can I improve this workflow".
---

# n8n Workflow Auditor

Framework for reviewing n8n workflow design quality. Use this alongside `n8n-validator`
(which catches technical errors) — this catches design and maintainability issues.

---

## How to Use This

1. Fetch the workflow: `n8n_get_workflow({id: "ID", mode: "full"})`
2. Run `n8n_validate_workflow` first — fix any validation errors before auditing design
3. Apply each audit category below
4. Return a structured audit report

---

## Audit Categories

### 1. Naming & Readability

**Node names**
- ❌ Bad: `HTTP Request`, `HTTP Request 1`, `Code`, `Set1`
- ✅ Good: `Fetch User from CRM`, `Format Email Body`, `Filter Active Subscriptions`
- Every node name should answer "what does this do?" not "what type is it?"

**Workflow name**
- Should describe the trigger + action: `[Trigger]: [What It Does]`
- Example: `Webhook: Process Stripe Payment`, `Daily: Email Sales Report`

**Notes/annotations**
- Complex branching logic should have notes explaining the "why"
- AI nodes should have notes on their prompt strategy

---

### 2. Error Handling Coverage

**Workflow-level error handling**
- Does the workflow have an Error Trigger workflow set? (Settings > Error Workflow)
- If not: any failure silently disappears — no alert, no retry

**Node-level error handling** — check each HTTP Request, Database, and Code node:
- HTTP Request nodes: is "On Error" set to something other than "Stop Workflow"?
- Code nodes: do they have try/catch wrapping risky operations?
- Database nodes: are they handling "0 rows returned" cases?

**Critical missing pattern:**
```
HTTP Request (API call)
├── Continue On Fail / Continue (Error Output)
│     └── IF: {{ $json.error || $json.statusCode >= 400 }}
│           ├── TRUE: error handler (Slack alert / log to DB / stop with message)
│           └── FALSE: continue normal flow
```

**Where error handling is NOT needed:** simple Set nodes, manual triggers, non-failing operations.

---

### 3. Retry Logic

APIs fail transiently. Check:
- HTTP Request nodes calling external APIs: do they have Retry On Fail enabled?
- Recommended: 3 retries, 2000ms between tries for most APIs
- Rate-limited APIs (429): need a Wait node + loop, not just retry

**Pattern: Rate limit handling**
```
HTTP Request → IF: {{ $json.statusCode === 429 }}
  TRUE: Wait ({{ parseInt($json.headers["retry-after"]) * 1000 || 5000 }}ms) → loop back
  FALSE: continue
```

---

### 4. Input Validation

For webhook-triggered workflows:
- Is there a validation step early in the flow to check required fields?
- What happens if required fields are missing or null?
- Example check node: IF `{{ !$json.body.email }}` → respond with 400 error

For scheduled workflows processing external data:
- What happens when the API returns 0 results?
- Is there a guard before processing empty arrays?

---

### 5. Webhook Security

If the workflow has a Webhook trigger:
- Is the webhook path obscure (not `/webhook/test`)? Use a UUID-style path.
- Is there any authentication? Options:
  - Header auth check (manually verify `X-Secret-Token` in an IF node)
  - IP allowlist
  - HMAC signature verification (for Stripe, GitHub, etc.)
- Webhook Response: does the workflow send a response quickly (before processing), or does it block the webhook until all processing completes?

**Best practice: Async webhook pattern**
```
Webhook → Respond immediately (200 OK) → Continue processing in background
```
vs synchronous (acceptable only if processing is <30 seconds and caller needs the result).

---

### 6. Performance Patterns

**Large dataset handling**
- Processing 1000+ records: is Split In Batches being used?
- Recommended batch size: 50–100 items for API calls, 500–1000 for simple transforms

**Parallel vs sequential**
- Independent API calls running sequentially (one after another) when they could run in parallel branches → missed optimization

**Unnecessary data retention**
- Is the workflow storing large payloads (full API responses) when only a few fields are needed?
- Use Set node to extract only needed fields early in the flow

**Execution frequency**
- Scheduled workflows: is the cron frequency appropriate? A workflow polling every minute for data that changes hourly is wasteful.

---

### 7. Code Node Quality

For any JavaScript or Python Code nodes in the workflow:

**Structure checks:**
- Does it return `[{ json: {...} }]` format?
- Does it handle the case where `$input.all()` returns an empty array?
- Are there try/catch blocks around operations that can fail?

**n8n-specific antipatterns:**
```javascript
// ❌ Bad — $input.item.json only works in single-item context
const data = $input.item.json.field;

// ✅ Good — explicit
const items = $input.all();
return items.map(item => ({ json: { result: item.json.field } }));
```

**Use the `code-reviewer` sub-agent** for detailed code review of Code nodes.
Call: "review the Code node in [workflow name]"

---

### 8. Documentation

**Workflow description**
- Is there a description set in workflow settings?
- Should answer: what triggers it, what it does, who it notifies

**Sticky notes**
- Complex logic should have a sticky note explaining the business rule
- AI nodes should document the prompt strategy
- Branch conditions should be labeled clearly

**Credential documentation**
- Are credentials named descriptively? (`Production Stripe` vs `My Key`)

---

## Audit Report Format

When auditing a workflow, produce this output:

---
## Workflow Audit: [Workflow Name]

**Audited**: [date]
**Workflow ID**: [id]
**Trigger type**: [webhook / schedule / manual]
**Node count**: [N]

### Overall Score
| Category | Status | Priority |
|---|---|---|
| Naming & Readability | ✅ Good / ⚠️ Issues / ❌ Poor | — |
| Error Handling | ✅ / ⚠️ / ❌ | High / Medium / Low |
| Retry Logic | ✅ / ⚠️ / ❌ | — |
| Input Validation | ✅ / ⚠️ / ❌ | — |
| Webhook Security | ✅ / ⚠️ / N/A | — |
| Performance | ✅ / ⚠️ / ❌ | — |
| Code Quality | ✅ / ⚠️ / ❌ / N/A | — |
| Documentation | ✅ / ⚠️ / ❌ | — |

### Issues Found

#### ❌ Critical (fix before production)
- [Issue]: [node name] — [what's wrong] → Fix: [specific action]

#### ⚠️ Should Fix
- [Issue]: [node name] — [what's wrong] → Suggestion: [improvement]

#### 💡 Nice to Have
- [minor improvement]

### What's Working Well
- [1-3 positive observations]

---

## Using with the n8n-validator Agent

**Recommended order:**
1. First run `n8n-validator` → fixes all technical errors (wrong fields, broken connections)
2. Then use this skill to audit design quality
3. For Code nodes: use `code-reviewer` agent for detailed JS/Python review

**To delegate a full audit to an agent**, describe the task as:
"Audit workflow [ID/name] for production readiness" — Claude will use this skill's framework while fetching workflow data via n8n MCP tools.
