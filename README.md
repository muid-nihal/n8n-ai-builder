# n8n AI Builder

**Build n8n workflows using natural language with any AI coding agent.**

n8n AI Builder is an open-source development environment that connects AI coding agents (Claude Code, Codex, Cursor, Windsurf, GitHub Copilot) to your [n8n](https://n8n.io) instance. Describe the automation you want in plain language, and your AI agent researches the right n8n nodes, builds the workflow JSON, validates it against your instance, and pushes it — ready to activate.

## Why Use This?

- **No manual JSON crafting** — your AI agent handles node configuration, connections, and parameters
- **Works with any AI agent** — Claude Code, Codex (CLI + Desktop), Cursor, Windsurf, GitHub Copilot
- **Two-stage validation** — local structure check + MCP instance-level validation catches errors before they hit n8n
- **8 expert skills** teach your agent n8n patterns, expressions, node config, and code best practices
- **MCP server integration** gives real-time access to 1,084 n8n node docs and 2,709 workflow templates
- **Version control** — every workflow change tracked in Git

## Quick Start

### Option 1: Let your AI agent set it up

Share this repo URL with your AI coding agent and say:

> "Help me set up this n8n workflow builder on my machine"

The agent reads [SETUP.md](SETUP.md) and walks you through everything — prerequisites, API key, configuration, verification.

### Option 2: Manual setup

```bash
git clone https://github.com/muid-nihal/n8n-ai-builder.git
cd n8n-ai-builder
npm install
cp .env.example .env
# Edit .env with your n8n API key and URL
npm run pull
```

### Start building

Tell your AI agent what you want:

```
"Create a workflow that monitors my website uptime every hour and sends me a Slack alert if it's down"

"Build a workflow that receives Stripe webhooks and logs payments to Google Sheets"

"Make a workflow that fetches new GitHub issues daily and posts a summary to Discord"
```

## How It Works

```
You describe what you want in natural language
        |
AI agent reads project instructions (learns n8n patterns, node config, validation rules)
        |
Researches nodes & templates (via MCP server — 1,084 nodes, 2,709 templates)
        |
Creates workflow JSON in workflows/
        |
Validates locally (npm run validate) + MCP validation (strict profile)
        |
Pushes to your n8n instance (npm run push)
        |
Workflow appears in n8n, ready to activate
```

## Agent Compatibility

| Agent | Instructions | Skills | MCP Server |
|-------|-------------|--------|------------|
| **Claude Code** (CLI + VS Code) | CLAUDE.md | Yes | Yes |
| **Codex** (CLI + Desktop) | AGENTS.md | Yes | Check docs |
| **Cursor** | .cursorrules | No | No |
| **Windsurf** | .windsurfrules | No | No |
| **GitHub Copilot** | .github/copilot-instructions.md | No | No |
| **Any other agent** | INSTRUCTIONS.md | No | No |

All instruction files contain identical content, auto-synced from a single `INSTRUCTIONS.md` via `npm run sync:instructions`.

## What's Included

### CLI Scripts

| Command | Description |
|---------|-------------|
| `npm run pull` | Download all workflows from n8n |
| `npm run push workflows/file.json` | Upload a workflow to n8n |
| `npm run validate workflows/file.json` | Validate a single workflow |
| `npm run validate:all` | Validate all workflows |
| `npm run run -- <id> --input data.json` | Run a webhook-triggered workflow |
| `npm run execute -- <id> --wait` | Execute a workflow and show results |
| `npm run sync:pull` | Pull + validate all |
| `npm run sync:push` | Validate + push changed files only |

### 8 Expert n8n Skills

Installable into Claude Code (`~/.claude/skills/`) or Codex (`~/.agents/skills/`):

| Skill | What It Teaches |
|-------|----------------|
| **n8n-mcp-tools-expert** | MCP tool usage for node discovery and workflow management |
| **n8n-expression-syntax** | n8n's `{{ }}` expression language, variables, common mistakes |
| **n8n-workflow-patterns** | 5 core patterns: webhook, API, database, AI agent, scheduled |
| **n8n-validation-expert** | Interpreting and fixing validation errors |
| **n8n-node-configuration** | Operation-aware node config, property dependencies |
| **n8n-code-javascript** | JavaScript in Code nodes — $input, $json, return formats |
| **n8n-code-python** | Python in Code nodes — _input, standard library |
| **n8n-workflow-auditor** | Design quality audit: naming, error handling, performance |

Install instructions: [skills/n8n/README.md](skills/n8n/README.md)

### MCP Server Integration

When configured, the [n8n-mcp](https://github.com/czlonkowski/n8n-mcp) server gives your agent:
- Documentation for all 1,084 n8n nodes (537 core + 547 community)
- 2,709 searchable workflow templates
- `validate_workflow` — validates JSON against your instance's actual schema
- `n8n_autofix_workflow` — auto-corrects typeVersion mismatches and expression errors
- Direct workflow create/update/test via API

Config template: `.mcp.json.example`

## Project Structure

```
n8n-ai-builder/
├── INSTRUCTIONS.md            # Canonical agent instructions (single source of truth)
├── CLAUDE.md                  # Auto-synced copy for Claude Code
├── AGENTS.md                  # Auto-synced copy for Codex
├── .cursorrules               # Auto-synced copy for Cursor
├── .windsurfrules             # Auto-synced copy for Windsurf
├── .github/copilot-instructions.md  # Auto-synced copy for Copilot
├── SETUP.md                   # Agent-guided setup protocol
├── .env.example               # API credentials template
├── .mcp.json.example          # MCP server config template
├── workflows/                 # Workflow JSON files (synced with n8n)
├── scripts/                   # Helper scripts
├── skills/n8n/                # 8 expert n8n skills
├── n8n-manager.js             # Core pull/push engine
├── validate-workflow.js       # Local JSON validation
└── package.json               # Project config
```

## Requirements

- **Node.js** v18+
- **An n8n instance** (cloud or self-hosted) with API access
- **An AI coding agent** (any — see compatibility table)
- **Git**

## FAQ

### What is n8n AI Builder?

n8n AI Builder is an open-source tool that lets AI coding agents create n8n automation workflows from natural language descriptions. Instead of manually building workflow JSON, you describe what you want and your AI agent builds, validates, and deploys it to your n8n instance.

### Which AI agents does it support?

It works with Claude Code, Codex (CLI and Desktop), Cursor, Windsurf, GitHub Copilot, and any other AI coding agent that reads project instruction files. Each agent has its own auto-synced instruction file.

### Do I need to know how to code?

No. The tool is designed so you can describe automations in plain language. Your AI agent handles the technical details — node configuration, JSON structure, validation, and deployment.

### How is this different from n8n's built-in AI features?

n8n's built-in AI helps within the n8n UI. n8n AI Builder works from your code editor or terminal, using your AI coding agent. It adds version control (Git), local validation, 8 expert skills, and MCP server integration that gives your agent access to all 1,084 node docs and 2,709 templates.

### Does it work with self-hosted n8n?

Yes. It works with n8n Cloud, self-hosted Docker instances, and npm-installed n8n. You just need API access enabled.

### Is it free?

Yes, fully open source under MIT license.

## Security

- `.env` is gitignored — API keys never get committed
- `.mcp.json` is gitignored — MCP credentials stay local
- Validation warns about sensitive data in workflow files
- Credentials use n8n's built-in credential system, not inline values

## Contributing

PRs welcome.

- **INSTRUCTIONS.md** — the core knowledge base. Edit this, then `npm run sync:instructions`
- **Skills** — each skill is in `skills/n8n/<name>/SKILL.md`
- **Scripts** — keep them generic and dependency-light

## Credits

- [n8n](https://n8n.io) — Workflow automation platform
- [n8n-mcp](https://github.com/czlonkowski/n8n-mcp) — MCP server for n8n node documentation
- [n8n-skills](https://github.com/czlonkowski/n8n-skills) — Original n8n skills

## License

MIT
