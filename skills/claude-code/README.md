# n8n Skills for Claude Code

These are 8 expert skills that teach Claude Code deep knowledge about n8n workflow development.

## What Are Skills?

Skills are markdown files that Claude Code loads as specialized knowledge. When you ask Claude Code to do something n8n-related, it reads the relevant skill to understand exactly how to help.

## Installation

Copy the skill folders to your Claude Code skills directory:

### Windows

```cmd
xcopy /E /I skills\claude-code\* "%USERPROFILE%\.claude\skills\"
```

### Mac / Linux

```bash
cp -r skills/claude-code/* ~/.claude/skills/
```

### Verify

After copying, restart Claude Code (close and reopen VS Code, or restart the CLI). Then ask:

> "What n8n skills do you have?"

Claude Code should list the 8 skills.

## Skills Included

### n8n-mcp-tools-expert
**Use first.** Master guide for using MCP tools — search_nodes, get_node, validate_node, create/update workflows. Covers tool selection, nodeType formats, common mistakes, and performance characteristics.

### n8n-expression-syntax
Everything about n8n's `{{ }}` expression language. Core variables ($json, $node, $now, $env), webhook data structure (.body nesting), common mistakes, and when NOT to use expressions (Code nodes).

### n8n-node-configuration
Operation-aware node configuration guidance. Property dependencies, progressive discovery with get_node detail levels, and specific patterns for HTTP Request, Slack, Google Sheets, IF, and database nodes.

Includes reference files:
- `HTTP_REQUEST_REFERENCE.md` — Complete HTTP Request node reference (auth, pagination, error handling, binary data)
- `GOOGLE_SHEETS_REFERENCE.md` — Complete Google Sheets node reference (append vs upsert, column mapping, known bugs)

### n8n-workflow-patterns
5 core architectural patterns:
1. Webhook Processing (most common)
2. HTTP API Integration
3. Database Operations
4. AI Agent Workflows
5. Scheduled Tasks

Plus data flow patterns, workflow creation checklist, and real template examples.

Includes: `ai_agent_workflow.md` — Complete AI Agent node reference (architecture, prompts, memory, tools, structured output).

### n8n-code-javascript
JavaScript in Code nodes — mode selection, data access patterns ($input.all, $input.first, $input.item), return format requirements, webhook data structure, built-in functions ($helpers.httpRequest, DateTime, $jmespath), error prevention, and 5 production patterns.

### n8n-code-python
Python in Code nodes — same concepts as JavaScript skill but for Python syntax. Covers _input/_json/_node, standard library limitations (no external packages), .get() for safe access, and when to prefer JavaScript instead.

### n8n-validation-expert
Interpreting and fixing validation errors. Error severity levels, the validation loop (expect 2-3 iterations), validation profiles (minimal/runtime/ai-friendly/strict), auto-sanitization system, false positives, and recovery strategies.

### n8n-workflow-auditor
Design quality audit framework. 8 audit categories: naming, error handling, retry logic, input validation, webhook security, performance, code quality, and documentation. Includes a structured report template.

## Keeping Skills Updated

These skills are snapshots. For the latest versions, check:
- [n8n-skills GitHub](https://github.com/czlonkowski/n8n-skills) — upstream source
- n8n docs at https://docs.n8n.io — for version-specific changes
