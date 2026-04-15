# CLAUDE.md - AI Agent Instructions for n8n Workflow Development

> **This file teaches any AI coding agent how to build, manage, and deploy n8n workflows.**
> It works with Claude Code, Codex, Cursor, Windsurf, and any agent that reads project instructions.

## Project Purpose

This project enables AI-powered n8n workflow creation through natural language. You (the AI agent) have tools and knowledge to build, validate, and manage n8n workflows on the user's n8n instance.

## First-Time Setup

If the user hasn't set up the project yet, read [SETUP.md](SETUP.md) and guide them through it conversationally.

---

## Available Tools

### CLI Scripts

| Command | Description |
|---------|-------------|
| `npm run pull` | Download all workflows from n8n instance |
| `npm run push workflows/file.json` | Upload/update a workflow to n8n |
| `npm run validate workflows/file.json` | Validate a single workflow |
| `npm run validate:all` | Validate all workflows |
| `npm run run -- <id> --input data.json` | Run a workflow via webhook trigger |
| `npm run execute -- <id> --wait` | Execute a workflow and poll for results |
| `npm run sync:pull` | Pull + validate all |
| `npm run sync:push` | Validate + push changed workflows |

### Skills (Claude Code Only)

If skills are installed in `~/.claude/skills/`, you have access to 8 expert n8n skills:

| Skill | Purpose | Priority |
|-------|---------|----------|
| **n8n-mcp-tools-expert** | MCP tool usage patterns | Highest - use first |
| **n8n-expression-syntax** | Expression syntax (`{{}}`) | When working with data transformations |
| **n8n-workflow-patterns** | Architecture & patterns | When designing workflows |
| **n8n-validation-expert** | Fix validation errors | When workflows fail validation |
| **n8n-node-configuration** | Node setup | When configuring specific nodes |
| **n8n-code-javascript** | JavaScript in Code nodes | For Code node JS |
| **n8n-code-python** | Python in Code nodes | For Code node Python |
| **n8n-workflow-auditor** | Design quality audit | When reviewing workflows |

### MCP Server (Claude Code Only)

If the n8n-mcp server is configured, you have direct access to:
- **1,084 n8n nodes** (537 core + 547 community) with documentation
- **2,709 workflow templates** with metadata
- Real-world examples and patterns

---

## How to Create a Workflow

Follow this process every time:

### 1. Understand Requirements

Ask clarifying questions if needed:
- What trigger should start the workflow?
- What data sources/destinations?
- What transformations are needed?
- Any specific n8n nodes to use?

### 2. Research (Critical Step)

**If you have MCP access:**
1. Search for relevant nodes: `search_nodes({query: "gmail"})`
2. Search for similar templates: `search_templates({query: "email automation"})`
3. Get node documentation: `get_node({nodeType: "nodes-base.gmail"})`

**If you don't have MCP access:**
- Use the knowledge in this file and the skills directory
- Pull existing workflows from the user's instance to learn patterns: `npm run pull`
- Reference n8n docs at https://docs.n8n.io

### 3. Design the Workflow Structure

Plan before building:
1. Trigger node (how it starts)
2. Processing nodes (what it does)
3. Output nodes (where results go)
4. Error handling (what happens when things fail)

### 4. Create the Workflow JSON

Build the workflow file in `workflows/`. **For new workflows, do NOT include an `"id"` field** — the push script will assign one.

### 5. Validate

```bash
npm run validate workflows/new-workflow.json
```

Fix any errors before pushing.

### 6. Push to n8n

```bash
npm run push workflows/new-workflow.json
```

The script will:
- Create the workflow on n8n (POST)
- Write the assigned ID back into the JSON file
- Rename the file to include the workflow ID

### 7. Commit

```bash
git add workflows/
git commit -m "Add workflow: description"
```

---

## Workflow JSON Structure

```json
{
  "name": "Descriptive Workflow Name",
  "nodes": [
    {
      "parameters": {},
      "id": "unique-uuid",
      "name": "Node Name",
      "type": "n8n-nodes-base.nodeName",
      "typeVersion": 1,
      "position": [x, y]
    }
  ],
  "connections": {
    "Node Name": {
      "main": [[{"node": "Next Node", "type": "main", "index": 0}]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

---

## Critical Knowledge

### Node typeVersions

**Always check the user's n8n instance for correct typeVersions** before creating workflows. Wrong versions cause "Could not find property option" errors on import.

**How to check:** Pull an existing workflow and look at the `typeVersion` fields:
```bash
npm run pull
# Then examine any workflow JSON in workflows/
```

**Common typeVersions (may vary by n8n version):**

| Node Type | Typical typeVersion |
|-----------|---------------------|
| `n8n-nodes-base.httpRequest` | 4.1 or 4.2 |
| `n8n-nodes-base.set` | 3.4 |
| `n8n-nodes-base.if` | 2.2 or 2.3 |
| `n8n-nodes-base.code` | 2 |
| `n8n-nodes-base.merge` | 3 or 3.2 |
| `n8n-nodes-base.switch` | 3.2 or 3.4 |
| `n8n-nodes-base.webhook` | 2 or 2.1 |
| `n8n-nodes-base.manualTrigger` | 1 |
| `n8n-nodes-base.scheduleTrigger` | 1.1 |
| `n8n-nodes-base.googleSheets` | 4.5 or 4.7 |
| `n8n-nodes-base.gmail` | 2.1 |
| `n8n-nodes-base.splitInBatches` | 3 |

**Always verify against the user's actual instance. Do not guess.**

### Read-Only Fields (Never Include When Pushing)

These fields cause API push errors:
- `updatedAt`, `createdAt`
- `active` (handled separately by the push script)
- `isArchived`
- `versionId`, `activeVersionId`, `versionCounter`
- `triggerCount`
- `shared`, `tags`
- `activeVersion`, `staticData`, `meta`, `pinData`

The `n8n-manager.js` push script strips these automatically.

### SplitInBatches (Loop Over Items) — Output Indices

**Output 0 = "done", Output 1 = "loop" — the opposite of what you'd expect.**

| Output index | Label | Purpose |
|---|---|---|
| 0 | done | Fires when ALL batches are finished |
| 1 | loop | Sends current batch items each iteration |

**Correct connection pattern:**
```json
"Loop Over Items": {
  "main": [
    [],
    [{ "node": "First Node In Loop", "type": "main", "index": 0 }]
  ]
}
```
The last node in the loop connects back to the SplitInBatches input:
```json
"Last Node In Loop": {
  "main": [[{ "node": "Loop Over Items", "type": "main", "index": 0 }]]
}
```

### Retry Loops (Backward Connections)

n8n supports backward connections (cycles). Use them for retry patterns:

1. A **Check node** (Code) validates output and tracks a retry counter
2. An **IF node** gates on the check result
3. On failure: a **Fix/Retry chain** connects back to the Check node
4. The Check node enforces a max retry limit to prevent infinite loops

```js
// Check node example
const structRetryCount = $json.structRetryCount || 0;
const MAX_RETRIES = 3;
return { ...$json, structOk: isValid || structRetryCount >= MAX_RETRIES, structRetryCount };
```

### Expression Syntax

Use `{{ }}` for dynamic content in node parameter fields:

```
{{ $json.field }}                    - Current node data
{{ $json.body.name }}               - Webhook data (always under .body!)
{{ $node["Node Name"].json.field }} - Data from specific node
{{ $now.toFormat('yyyy-MM-dd') }}   - Current date
```

**Critical:** Webhook data is under `$json.body`, NOT `$json` directly.

**In Code nodes:** Use JavaScript directly, NOT expressions:
```javascript
// Code node — NO {{ }}
const email = $input.first().json.email;
```

### IF Node Configuration (typeVersion 2.2+)

```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "loose"
      },
      "conditions": [
        {
          "id": "condition-1",
          "leftValue": "={{ $json.field }}",
          "rightValue": "value",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.3
}
```

### Common Import Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Could not find property option" | Wrong typeVersion | Check user's n8n instance for correct versions |
| Broken/missing node on canvas | Sub-node used standalone | Use HTTP Request node instead |
| API push rejected (400) | Read-only fields in JSON | The push script handles this, but avoid them in manual calls |
| Blank canvas after push | Structure mismatches | Try manual import: n8n UI > Menu > Import from File |

### Sub-Nodes (Cannot Be Used Standalone)

These nodes only work inside AI Agent workflows, NOT as standalone nodes:
- `n8n-nodes-langchain.embeddingsOpenAi`
- `n8n-nodes-langchain.lmChatOpenAi`
- Other langchain sub-nodes

**Use HTTP Request node to call APIs directly instead.**

---

## Workflow Naming Convention

```
<descriptive_name>_<workflow_id>.json
```

- Use lowercase with underscores
- Be descriptive: `gmail_daily_digest_abc123.json` not `workflow1.json`
- The push script adds the workflow ID automatically after first push

---

## Error Handling Best Practices

Every workflow should include error handling:

1. **Error Trigger node** — catches workflow-level errors
2. **IF nodes** — for conditional logic and error checking
3. **Continue On Fail** — per-node setting for graceful degradation
4. **Stop And Error nodes** — for critical failures that should halt execution

---

## Code Node Best Practices

### JavaScript (Preferred)

```javascript
// Always return array of {json: {...}} objects
const items = $input.all();
return items.map(item => ({
  json: {
    ...item.json,
    processed: true
  }
}));
```

Key rules:
- Must return `[{json: {...}}]` format
- Use `$input.all()` for all items, `$input.first()` for single item
- Webhook data is under `.body`: `$json.body.email`
- `$helpers.httpRequest()` for HTTP calls inside Code nodes
- `DateTime` (Luxon) for date/time operations

### Python

```python
items = _input.all()
return [{"json": {**item["json"], "processed": True}} for item in items]
```

Key rules:
- Same return format: `[{"json": {...}}]`
- Use `_input.all()`, `_input.first()`, `_input.item`
- **No external libraries** — standard library only (json, datetime, re, etc.)
- Use `.get()` for safe dictionary access

---

## Security

### Never Commit
- `.env` file (contains API key)
- `.mcp.json` file (contains MCP config)
- API keys or credentials in workflow JSON

### Always Check
- `.gitignore` includes `.env` and `.mcp.json`
- Workflows don't contain hardcoded credentials
- Credentials use n8n's credential system, not inline values

---

## Quality Checklist

Before considering a workflow complete:

- [ ] Workflow researched (MCP search or docs review)
- [ ] All nodes properly configured with correct typeVersions
- [ ] Connections are correct
- [ ] Error handling included
- [ ] Validation passes (`npm run validate`)
- [ ] Pushed to n8n (`npm run push`)
- [ ] File renamed with workflow ID
- [ ] Committed to git

---

## Common Pitfalls

### Don't
- Create workflows without researching nodes first
- Skip validation before pushing
- Hardcode credentials in workflows
- Include `id` field for new workflows (let the push script handle it)
- Guess node parameter structures — verify from docs or existing workflows
- Use wrong typeVersions — always check the user's instance
- Use sub-nodes as standalone nodes

### Do
- Always start with research (MCP search or docs)
- Validate locally before pushing
- Use environment variables for credentials
- Follow naming conventions
- Pull existing workflows to learn patterns
- Test workflows after pushing
- Use backward-connection loops for retries instead of duplicated chains

---

## Resources

- [n8n Documentation](https://docs.n8n.io)
- [n8n-mcp GitHub](https://github.com/czlonkowski/n8n-mcp) — MCP server for node docs
- [n8n-skills GitHub](https://github.com/czlonkowski/n8n-skills) — Claude Code skills for n8n
- [SETUP.md](SETUP.md) — First-time setup guide (agent-readable)

---

## Process Summary

**Your workflow: Research > Design > Create > Validate > Push > Commit**

When a user asks you to build a workflow, follow this loop. Be thorough in research, precise in configuration, and always validate before pushing.
