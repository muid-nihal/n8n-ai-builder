# n8n AI Agent Workflows — Complete Reference

Last verified: March 2026 against n8n docs and community sources.

---

## 1. Architecture Overview

The AI Agent node is a **cluster root node** — it cannot function alone. It requires:
- One **LLM sub-node** connected via `ai_languageModel` port
- Optionally: memory sub-nodes, tool sub-nodes, output parser sub-nodes

All sub-nodes connect to the agent via dedicated ports on the left side of the node.

### Node Type Decision Guide

| Scenario | Use |
|---|---|
| Direct API call, single LLM response, no tools | **OpenAI node** (standalone app node) |
| Tool calling, memory, or multi-step reasoning | **AI Agent node** (LangChain cluster) |
| OpenAI Assistants API | **OpenAI node** → Assistants resource |
| Multiple chained LLM calls with branching | **Basic LLM Chain** or sequential AI Agent nodes |
| Structured JSON output from a chain (not agent) | **LLM Chain** + **Structured Output Parser** |
| RAG with vector search | **AI Agent** + **Vector Store Tool** sub-node |
| Model-agnostic (swap providers easily) | **AI Agent** + swap the LLM sub-node |

**Rule of thumb:** Use standalone OpenAI node for predictable single-shot output. Use AI Agent for autonomous decision-making, tool routing, or stateful memory.

### Legacy Agent Types (pre-v1.82)

Prior to v1.82, you could select agent types inside the node. That selector has been removed — all AI Agent nodes now run as the **Tools Agent** by default.

Legacy types still exist as separate nodes:

| Node | Use Case |
|---|---|
| **Tools Agent** (default) | General-purpose with tool-calling |
| **Conversational Agent** | Simple chat, no tool support |
| **ReAct Agent** | Reason + Act loop for complex multi-hop tasks |
| **OpenAI Functions Agent** | Deprecated; use Tools Agent instead |

---

## 2. System Prompt Patterns

### Standard Structure

```
## Role
You are [persona]. Your job is [primary objective].

## Capabilities
You have access to the following tools:
- [tool_name]: [what it does, when to use it]

## Rules
1. [Hard constraint — never break]
2. [Behavioral rule]
3. Always respond in [language/format].
4. If you cannot complete a task, explain why instead of guessing.

## Output Format
[Exact format specification]

## Context
Today's date: {{ $now.toFormat('yyyy-MM-dd') }}
User: {{ $json.userName }}
```

### Key Principles

- **Name each tool explicitly** and describe when to use it. Vague tool descriptions = bad tool selection.
- **State output format twice**: in system prompt AND via Structured Output Parser sub-node.
- **Use role framing.** "You are a senior data analyst" outperforms "Analyze this data."
- **Inject date/time** when temporal reasoning matters: `{{ $now.toFormat('yyyy-MM-dd') }}`
- **Keep instructions numbered.** LLMs follow ordered lists more reliably than paragraphs.
- **Tell it what NOT to do**, not just what to do.
- **Be explicit about conciseness**: "Return only the requested output. No preamble. No disclaimers."

**Critical gotcha:** Literal `{` or `}` in system prompts (e.g., in JSON examples) cause `"Single '{' in template"` errors. Escape as `{{` and `}}`, or describe the JSON structure in prose instead of showing it.

---

## 3. Passing Dynamic Data into Prompts

n8n uses `{{ expression }}` syntax in both System Prompt and User Message fields.

### Expression Examples

```
{{ $json.email }}                                  // Current item field
{{ $json.body.userMessage }}                       // Nested field
{{ $node["HTTP Request"].json.data }}              // From named node
{{ $('Get User').item.json.name }}                 // From named node (modern syntax)
{{ $vars.COMPANY_NAME }}                           // Workflow static variable
{{ $now.toFormat('MMMM dd, yyyy') }}              // Formatted date
{{ $json.content.slice(0, 2000) }}                // Truncate to stay within context
{{ $json.isPremium ? 'Full access.' : 'Free tier: limit to 100 words.' }}  // Conditional
```

### Injecting Previous Node Data

```
## User Context
Name: {{ $('Get User').item.json.name }}
Account type: {{ $('Get User').item.json.tier }}
Recent orders: {{ $('Fetch Orders').item.json.orders.slice(0,3).map(o => o.id).join(', ') }}
```

### Important Limitation for Sub-nodes

In sub-nodes (memory, tool, output parser), expressions **always resolve to the first item** regardless of iteration. To pass per-item dynamic data into tools, use `$fromAI()` instead.

---

## 4. Memory Types

| Memory Type | Storage | Use Case | Persists? |
|---|---|---|---|
| **Simple Memory** (Buffer) | RAM | Dev/testing only | ❌ Lost on restart |
| **Window Buffer Memory** | RAM | Short conversations (last N messages) | ❌ Lost on restart |
| **Postgres Chat Memory** | PostgreSQL | Production stateful agents | ✅ |
| **Redis Chat Memory** | Redis | High-throughput real-time chat | ✅ |
| **MongoDB Chat Memory** | MongoDB | Flexible schema | ✅ |
| **Vector Store (as RAG)** | Pinecone/Qdrant/PGVector | Semantic search over knowledge base | ✅ |

**#1 production footgun:** Simple Memory does not persist across restarts. Always use Postgres or Redis in production.

### Postgres Chat Memory Config

Key parameters:
- **Session ID**: `{{ $sessionId }}` or a user identifier expression — scopes memory per user
- **Context Window Length**: 10–20 message pairs is typical
- **Table Name**: defaults to `n8n_chat_histories`

### Hybrid Memory Pattern (Production)

```
Short-term:  Window Buffer Memory (last 10 messages) — fast, no DB call
Long-term:   Postgres Chat Memory — full history
Semantic:    Vector Store Tool — RAG over knowledge base documents
```

Chat memory answers "what did we just discuss?" — Vector stores answer "what do I know about this topic?"

---

## 5. Tool Sub-Nodes

### Available Tool Sub-Nodes

| Tool Node | What It Does |
|---|---|
| **HTTP Request Tool** | Call any external API |
| **Code Tool** | Execute JavaScript/Python as a tool |
| **Calculator Tool** | Math operations (prevents hallucinated arithmetic) |
| **Wikipedia Tool** | Search Wikipedia |
| **SerpAPI Tool** | Google Search |
| **Vector Store Tool** | Semantic search over a vector DB |
| **AI Agent Tool** | Call another AI Agent as a sub-agent |
| **Call n8n Workflow Tool** | Execute a separate n8n workflow as a tool |

### The `$fromAI()` Function

Used inside tool node fields to let the LLM dynamically populate parameters:

```
$fromAI("key", "description", "type", defaultValue)
```

Example in an HTTP Request Tool body:
```json
{
  "email": "{{ $fromAI('email', 'The user email address to look up', 'string') }}",
  "limit": "{{ $fromAI('limit', 'Max results to return', 'number', 10) }}"
}
```

- Key name is a semantic hint to the LLM — name clearly
- Only works in tool sub-nodes connected to an AI Agent
- Cannot use external variables or use it in Code tool nodes

### Writing Good Tool Descriptions

The tool's **Name** and **Description** are fed verbatim to the LLM. Write them like API docs:

```
Name: search_customer_orders
Description: Search a customer's order history by email address. Returns a list of orders
with status, amount, and date. Use this when the user asks about their orders, deliveries,
or purchase history. Do NOT use for account or billing questions.
```

### Multi-Agent Architecture

```
Orchestrator Agent
├── Tool: Sub-Agent A (research specialist)
├── Tool: Sub-Agent B (data analyst)
├── Tool: Call Workflow (send email, write to DB)
└── Tool: HTTP Request (external API)
```

Use **AI Agent Tool** sub-node for nested agents. Use **Call n8n Workflow Tool** when the tool logic needs branching, error handling, and multiple nodes.

---

## 6. Structured Output

### Structured Output Parser Sub-Node

Two configuration modes:
1. **Generate from JSON Example** — paste a sample JSON, node infers schema
2. **Define using JSON Schema** — write the schema manually

Example schema:
```json
{
  "type": "object",
  "properties": {
    "sentiment": { "type": "string", "enum": ["positive", "negative", "neutral"] },
    "confidence": { "type": "number" },
    "summary": { "type": "string" },
    "topics": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["sentiment", "confidence", "summary"]
}
```

**Known issue (GitHub #20029):** The AI Agent node can double-nest the output key (`output.output`), causing schema validation errors. Workaround: use **LLM Chain** (not AI Agent) when structured output is the primary goal, or extract `$json.output.output` downstream.

### Auto-Fixing Output Parser

Chains a secondary LLM call to repair malformed JSON. Add as a sub-node wrapping the Structured Output Parser. Adds latency and token cost, but dramatically improves reliability.

### Manual JSON Extraction (Code Node Fallback)

```javascript
const raw = $input.item.json.output;
const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
const jsonStr = match ? match[1] : raw;
try {
  return [{ json: JSON.parse(jsonStr.trim()) }];
} catch {
  const cleaned = jsonStr.replace(/[\x00-\x1F]/g, '').trim();
  return [{ json: JSON.parse(cleaned) }];
}
```

### Accessing Output Downstream

```
{{ $json.output }}                              // Raw agent text output
{{ $json.output.fieldName }}                   // Parsed structured field
{{ $('Agent Node').item.json.output }}         // From a named previous node
```

---

## 7. Token Management

| Strategy | How |
|---|---|
| Truncate inputs | `{{ $json.content.slice(0, 3000) }}` before reaching the agent |
| Pre-summarize long docs | LLM Chain to bullet-point summary → feed summary, not raw doc |
| Limit memory window | Set Context Window Length to 10–20 message pairs |
| Strip HTML | Run the **Markdown node** before passing scraped content (removes 30–50% token waste) |
| Tier models by cost | Cheap models (Haiku, GPT-4o-mini) for classification/routing; expensive for synthesis |
| Monitor token usage | Execution details show per-node token counts — check during dev |

### Context Windows (Approximate)

| Model | Context | Practical Limit |
|---|---|---|
| GPT-4o | 128K | Keep under 60K |
| GPT-4o-mini | 128K | Keep under 30K |
| Claude 3.5 Sonnet | 200K | Keep under 100K |
| Claude 3 Haiku | 200K | Keep under 50K |

---

## 8. Workflow Patterns

### RAG Pattern

```
[Ingestion Sub-workflow]
File/URL → Text Extractor → Recursive Character Text Splitter →
Embeddings Model → Vector Store (insert)

[Query Sub-workflow]
User Query → AI Agent
  ├── Memory: Window Buffer Memory
  └── Tool: Vector Store Retriever Tool
       └── Embeddings Model → Vector Store (search)
Agent synthesizes retrieved chunks → Response
```

### Summarization Chain (Map-Reduce)

```
Long Document → Split into chunks (Text Splitter) →
Loop: LLM Chain ("Summarize this chunk in 3 sentences") →
Aggregate chunk summaries →
Final LLM Chain ("Combine these summaries into one coherent summary")
```

Handles documents larger than a single context window.

### Extraction Pipeline

```
Raw Input (email/form/document) →
AI Agent: "Extract the following fields as JSON: name, email, request_type, urgency (1-5)" →
Structured Output Parser →
Validation Code Node (check required fields) →
Database/CRM upsert
```

### Classification Router

```
Inbound message →
LLM Chain (cheap model): "Classify as: billing | technical | sales | other" →
Switch node →
  billing → Billing Agent
  technical → Tech Support Agent
  sales → Sales Agent
  other → Human handoff / Slack notification
```

### Answer Critic Chain

```
Agent A: Generates answer
    ↓
Agent B (Critic): "Evaluate if ANSWER fully addresses QUESTION. State what is missing."
    ↓
IF: critic approves → output
IF: critic flags issue → loop back to Agent A with critique
```

### Sequential Prompt Chaining

```javascript
// Node 1 system prompt
"Extract key facts from the document."

// Node 2 system prompt (references Node 1 output)
"Given these facts: {{ $('Extract Facts').item.json.output }}, classify the intent..."

// Node 3 system prompt
"You are responding to a {{ $('Classify Intent').item.json.output }} inquiry. Draft a response..."
```

### Parallel Chain (Reduce Latency)

Trigger → split → run multiple AI nodes simultaneously → Merge node → synthesize.
Reduces total latency by 40–60% vs sequential for independent subtasks.

---

## 9. Anthropic/Claude vs OpenAI in n8n

Both are **sub-nodes** plugged into the AI Agent as the language model (not standalone nodes for agent use).

### Configuration Differences

| Parameter | OpenAI Chat Model | Anthropic Chat Model |
|---|---|---|
| Temperature | 0.0–2.0 | 0.0–1.0 |
| Top K | Not available | Available |
| Frequency/Presence Penalty | Available | Not available |
| Extended Thinking | Not native | Available (Claude 3.7+) |

### When to Use Claude vs GPT

| Task | Recommendation |
|---|---|
| Long document analysis (>100K tokens) | Claude (200K context) |
| Complex instruction following | Claude Sonnet/Opus |
| Extended reasoning / multi-hop | Claude with extended thinking |
| JSON output reliability | GPT-4o (community reports: more consistent) |
| Cost-sensitive classification | Claude Haiku or GPT-4o-mini |
| Code generation | Comparable; either works |

**Claude behavior note:** Claude is more verbose and adds caveats. For automation, explicitly add: "Be concise. Do not add disclaimers. Return only the requested output."

**Extended Thinking (Claude 3.7 Sonnet):** Available via Anthropic Chat Model sub-node. Adds latency and token cost; useful for complex planning agents.

---

## 10. Error Handling

### What Fails and How to Fix It

| Error | Cause | Fix |
|---|---|---|
| Rate limit (429) | Too many requests/min | Retry On Fail + Wait node (5–15s) |
| Context length exceeded (400) | Prompt + history + input too large | Reduce memory window; truncate inputs |
| JSON parse error | Malformed output | Add Auto-Fixing Output Parser; use Code node fallback |
| Tool selection failure | Agent picks wrong tool | Improve tool descriptions; keep total tools under 5 |
| Infinite loop | Agent keeps calling tools | Set max iterations; add explicit termination in system prompt |
| "Single '{' in template" | Literal `{` in system prompt | Escape as `{{` or restructure prompt |

### Retry Configuration

Settings → **Retry On Fail** → 3–5 attempts. For rate limits, add a Wait node (5–15s) before the AI node in a loop.

### Fallback LLM

The AI Agent node supports a **Fallback LLM** sub-connection — attach a secondary LLM sub-node (e.g., Claude as fallback when OpenAI fails). Native feature, no extra logic.

### Error Workflow

In workflow settings: set **Error Workflow** to a separate workflow that logs failed execution details and optionally retries with a different model.

---

## 11. Ready-to-Use Prompt Templates

### General-Purpose Automation Agent

```
## Role
You are an intelligent automation assistant. Execute tasks precisely and return structured results.

## Rules
1. Complete the requested task — do not ask clarifying questions.
2. If a tool returns an error, try once with different parameters, then report the failure.
3. Never invent data. If information is not available, say "Not found."
4. Respond only with the final answer — no preamble or explanation unless asked.

## Context
Current date: {{ $now.toFormat('yyyy-MM-dd') }}
```

### RAG Knowledge Assistant

```
## Role
You are a knowledge assistant with access to a company knowledge base.

## Instructions
1. ALWAYS search the knowledge base before answering.
2. Base your answer ONLY on retrieved documents.
3. If the knowledge base returns no relevant results, say:
   "I don't have information on that topic."
4. Cite the document title when referencing specific information.

## Output Format
**Answer:** [Answer based on retrieved documents]
**Sources:** [Document title(s) referenced]
```

### Email Classification + Extraction

```
## Role
You are an email triage assistant. Extract structured data from the email.

## Task
Extract and return JSON with these exact fields:
- "category": one of [billing, technical_support, sales, refund, other]
- "urgency": integer 1-5 (5 = critical)
- "sentiment": one of [positive, neutral, negative, angry]
- "customer_name": string or null
- "key_issue": one-sentence summary
- "suggested_action": brief recommended next step

## Input
Sender: {{ $json.from }}
Subject: {{ $json.subject }}
Body: {{ $json.body.slice(0, 2000) }}

Return ONLY the JSON object, no markdown, no explanation.
```

### Document Chunk Summarization

```
## Task
Summarize the following document chunk into exactly 3 bullet points.
Each bullet: one sentence maximum.
Focus on facts, actions, decisions — omit filler.

## Document Chunk
{{ $json.chunk }}

Return only the 3 bullet points. No headers. No preamble.
```

### Data Extraction

```
## Task
Extract all structured data from the following text.
Return ONLY a valid JSON object — no markdown, no code blocks, no explanation.

## Schema
{
  "company_name": "string",
  "contact_email": "string or null",
  "phone": "string or null",
  "products_mentioned": ["array of strings"],
  "requested_action": "string describing what they want"
}

## Text
{{ $json.rawText.slice(0, 3000) }}
```

### Research Agent (Plan-Search-Synthesize)

```
## Role
You are a research agent. You gather information systematically and produce verified summaries.

## Process
1. PLAN: Identify 2-3 specific searches needed to answer the question thoroughly.
2. SEARCH: Execute each search using the search tool.
3. SYNTHESIZE: Combine findings into a coherent answer.
4. VERIFY: Check that your answer directly addresses the original question.

## Rules
- Do not answer from memory alone — always search first.
- If sources conflict, note the conflict and explain which to trust.
- Keep final answers under 300 words unless more detail is requested.

## Output Format
**Answer:** [Main answer]
**Confidence:** [High/Medium/Low]
**Sources Checked:** [List of sources searched]
```

---

## 12. Known Issues (early 2026)

- **Agent type selector removed in v1.82+**: Legacy workflows referencing old agent type settings need re-verification on update.
- **Structured Output Parser double-nesting (GitHub #20029)**: Check if resolved in your version; workaround is using LLM Chain instead of AI Agent for structured output.
- **Simple Memory in production**: Does NOT persist across restarts — always migrate to Postgres/Redis.
- **`$fromAI()` limitations**: Cannot pass external variables; does not work in Code tool nodes.
- **OAuth2 with HTTP Request Tool node (AI agent sub-node) (GitHub #11025)**: Known issues with generic OAuth2 credentials. Use predefined credentials or Bearer Header Auth instead.
- **Extended Thinking (Claude 3.7)**: May not be available in older n8n builds — verify before designing workflows around it.
