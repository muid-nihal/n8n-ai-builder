# n8n AI Workflow Builder

Build n8n workflows using natural language with any AI coding agent.

Describe what you want automated. Your AI agent researches the right n8n nodes, builds the workflow JSON, validates it, and pushes it to your n8n instance — all from the terminal.

## What This Is

A development environment that connects your AI coding agent to your n8n instance. It includes:

- **Pull/push scripts** to sync workflows between local files and n8n
- **Validation** to catch errors before they hit your instance
- **Universal agent instructions** that teach any AI agent how to build n8n workflows correctly
- **8 expert skills** for agents that support them (Claude Code, Codex)
- **MCP server support** for real-time access to 1,084 n8n node docs and 2,709 templates
- **Git version control** for full workflow change history

## Quick Start

### 1. Give this repo to your AI agent

If you're using an AI coding agent, just share this repo URL and say:

> "Help me set up this n8n workflow builder on my machine"

The agent will read [SETUP.md](SETUP.md) and walk you through everything step by step — including installing prerequisites, connecting to your n8n instance, and verifying the setup.

### 2. Or set up manually

```bash
# Clone
git clone https://github.com/muid-nihal/n8n-ai-workflow-builder.git
cd n8n-ai-workflow-builder

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your n8n API key and URL

# Test
npm run pull
```

### 3. Start building

Tell your AI agent what you want:

```
"Create a workflow that monitors my website uptime every hour and sends me a Slack alert if it's down"

"Build a workflow that receives Stripe webhooks and logs payments to Google Sheets"

"Make a workflow that fetches new GitHub issues daily and posts a summary to Discord"
```

## How It Works

```
You describe what you want
        |
AI agent reads project instructions (learns n8n patterns)
        |
Researches nodes & templates (via MCP or docs)
        |
Creates workflow JSON in workflows/
        |
Validates locally (npm run validate)
        |
Pushes to your n8n instance (npm run push)
        |
Workflow appears in n8n, ready to activate
```

## Available Commands

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
| `npm run sync:instructions` | Sync INSTRUCTIONS.md to all agent files |

## Project Structure

```
n8n-ai-workflow-builder/
├── INSTRUCTIONS.md            # Canonical agent instructions (single source of truth)
├── CLAUDE.md                  # -> Claude Code reads this (auto-synced copy)
├── AGENTS.md                  # -> Codex reads this (auto-synced copy)
├── .cursorrules               # -> Cursor reads this (auto-synced copy)
├── .windsurfrules             # -> Windsurf reads this (auto-synced copy)
├── .github/
│   └── copilot-instructions.md # -> Copilot reads this (auto-synced copy)
├── SETUP.md                   # Agent-guided setup protocol
├── .env.example               # Template for API credentials
├── .mcp.json.example          # Template for MCP server config
├── workflows/                 # n8n workflow JSON files (synced with your instance)
├── scripts/                   # Helper scripts (run, execute, sync, etc.)
├── skills/
│   └── n8n/                   # 8 expert n8n skills (agent-neutral)
├── n8n-manager.js             # Core pull/push engine
├── validate-workflow.js       # Workflow validation
├── package.json               # Project config
└── README.md                  # This file
```

## Agent Compatibility

| Agent | Instructions | Skills | MCP Server |
|-------|-------------|--------|------------|
| **Claude Code** (CLI + VS Code) | CLAUDE.md | Yes (`~/.claude/skills/`) | Yes |
| **Codex CLI** | AGENTS.md | Yes (`~/.agents/skills/`) | Check docs |
| **Codex Desktop** | AGENTS.md | Yes (`~/.agents/skills/`) | Check docs |
| **Cursor** | .cursorrules | No | No |
| **Windsurf** | .windsurfrules | No | No |
| **GitHub Copilot** | .github/copilot-instructions.md | No | No |
| **Any other agent** | INSTRUCTIONS.md (manual) | No | No |

All instruction files contain identical content — they're auto-synced copies of `INSTRUCTIONS.md`. Edit the canonical file and run `npm run sync:instructions` to propagate.

## Included Skills

The `skills/n8n/` directory contains 8 expert skills installable into Claude Code or Codex:

| Skill | What It Teaches |
|-------|----------------|
| **n8n-mcp-tools-expert** | How to use MCP tools effectively for node discovery and workflow management |
| **n8n-expression-syntax** | n8n's `{{ }}` expression language — variables, data access, common mistakes |
| **n8n-workflow-patterns** | 5 core architectural patterns (webhook, API, database, AI agent, scheduled) |
| **n8n-validation-expert** | How to interpret and fix validation errors, profiles, auto-sanitization |
| **n8n-node-configuration** | Operation-aware node config, property dependencies, progressive discovery |
| **n8n-code-javascript** | JavaScript in Code nodes — $input, $json, return formats, built-in helpers |
| **n8n-code-python** | Python in Code nodes — _input, standard library, limitations |
| **n8n-workflow-auditor** | Design quality audit — naming, error handling, performance, security |

Install instructions are in [skills/n8n/README.md](skills/n8n/README.md).

## Requirements

- **Node.js** v18+ (for running scripts)
- **An n8n instance** (cloud or self-hosted) with API access enabled
- **An AI coding agent** (any — see compatibility table)
- **Git** (for version control)

## Security

- `.env` is gitignored — your API key never gets committed
- `.mcp.json` is gitignored — MCP credentials stay local
- The validation script warns about sensitive data in workflows
- Credentials should use n8n's credential system, not inline values

## Contributing

Found a bug or want to improve the agent instructions? PRs welcome.

- **INSTRUCTIONS.md**: The core knowledge base — edit this, then run `npm run sync:instructions`
- **Skills**: Each skill is in `skills/n8n/<name>/SKILL.md`
- **Scripts**: Keep them generic and dependency-light (only `dotenv`)

## Credits

- [n8n](https://n8n.io) — The workflow automation platform
- [n8n-mcp](https://github.com/czlonkowski/n8n-mcp) — MCP server for n8n node documentation
- [n8n-skills](https://github.com/czlonkowski/n8n-skills) — Original skills for n8n

## License

MIT
