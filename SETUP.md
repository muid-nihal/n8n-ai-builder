# Agent Setup Protocol

> **This file is for AI agents.** When a user gives you this repo and asks you to help them set up, follow this protocol.
> It works with any agent: Claude Code, Codex, Cursor, Windsurf, Copilot, or CLI tools.

---

## Your Role

You are helping a user set up an AI-powered n8n workflow development environment on their machine. The user may be non-technical. Your job is to:

1. **Ask questions** to understand their situation before doing anything
2. **Guide them step by step** with exact instructions for their OS
3. **Verify each step** before moving to the next
4. **Explain what things are** in plain language when needed

**Do not dump all steps at once.** Walk them through it conversationally.

---

## Phase 1: Understand the User's Situation

Before any setup, ask these questions (you can ask them all at once):

1. **What operating system are you on?** (Windows, Mac, Linux)
2. **Do you already have an n8n instance running?** (cloud at app.n8n.cloud, self-hosted, or not yet)
3. **Do you have Node.js installed?** (they can check by running `node --version` in their terminal)
4. **What AI coding agent are you using?** (Claude Code, Codex CLI, Codex Desktop, Cursor, Windsurf, Copilot, other)
5. **Have you used n8n before?** (helps you calibrate how much to explain)

Wait for their answers before proceeding.

---

## Phase 2: Prerequisites

Based on their answers, guide them through any missing prerequisites.

### Node.js (Required)

If they don't have Node.js:

- **Windows**: Download from https://nodejs.org (LTS version). Run the installer, accept defaults.
- **Mac**: `brew install node` (if they have Homebrew) or download from https://nodejs.org
- **Linux**: `sudo apt install nodejs npm` (Ubuntu/Debian) or `sudo dnf install nodejs` (Fedora)

Verify: `node --version` should show v18 or higher.

### n8n Instance (Required)

If they don't have n8n yet, explain the options:

1. **n8n Cloud** (easiest): Sign up at https://app.n8n.cloud — free tier available, no server needed
2. **Self-hosted with Docker** (more control):
   ```bash
   docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
   ```
   Then open http://localhost:5678
3. **Self-hosted with npm** (simplest self-host):
   ```bash
   npm install -g n8n
   n8n start
   ```

Tell them: "n8n is a visual workflow automation tool — like Zapier but you own it. You'll build workflows in its web UI, and this repo lets your AI agent create and manage those workflows programmatically."

### Git (Required)

Verify: `git --version`. If missing:
- **Windows**: Download from https://git-scm.com
- **Mac**: `xcode-select --install` or `brew install git`
- **Linux**: `sudo apt install git`

---

## Phase 3: Clone and Install

Guide them through:

```bash
# Clone the repo
git clone <REPO_URL> n8n-ai-workflow-builder
cd n8n-ai-workflow-builder

# Install dependencies (just one package: dotenv)
npm install
```

---

## Phase 4: Connect to n8n

This is the most important step. Walk them through it carefully.

### Step 1: Get the n8n API Key

Give them exact UI steps:

1. Open your n8n instance in a browser
2. Click the **user icon** (bottom-left corner)
3. Click **Settings**
4. Click **API** in the left sidebar
5. Click **Create an API Key** (or copy existing one)
6. **Copy the API key** — you'll need it in the next step

If they can't find the API section:
- n8n Cloud: API is available on all plans
- Self-hosted: API is enabled by default on recent versions. If missing, they need to set `N8N_PUBLIC_API_ENABLED=true` in their n8n environment.

### Step 2: Create the .env file

```bash
# Copy the template
cp .env.example .env
```

Then tell them to edit `.env` and fill in:

```
N8N_API_KEY=their-api-key-here
N8N_URL=https://their-n8n-instance.app.n8n.cloud/
```

**Common URL formats:**
- n8n Cloud: `https://yourname.app.n8n.cloud/`
- Self-hosted: `http://localhost:5678/`
- Custom domain: `https://n8n.yourdomain.com/`

**Important:** The URL must include the protocol (`https://` or `http://`) and trailing slash.

### Step 3: Test the Connection

```bash
npm run pull
```

If it works, they'll see their workflows being downloaded. If they have no workflows yet, it will complete with 0 workflows — that's fine.

**Common errors:**
- `API Error [401]`: Wrong API key. Double-check copy/paste.
- `API Error [404]`: Wrong URL. Check the URL format.
- `fetch failed` or `ECONNREFUSED`: n8n is not running or URL is wrong.

---

## Phase 5: Agent-Specific Setup

This project is designed to work with any AI coding agent. The table below shows what each agent uses:

### Agent Mapping

| Feature | Claude Code | Codex (CLI + Desktop) | Cursor | Windsurf | Copilot |
|---------|------------|----------------------|--------|----------|---------|
| **Instructions file** | CLAUDE.md | AGENTS.md | .cursorrules | .windsurfrules | .github/copilot-instructions.md |
| **Skills support** | Yes | Yes | No | No | No |
| **Skills path** | `~/.claude/skills/` | `~/.agents/skills/` | — | — | — |
| **MCP support** | Yes | Check docs | No | No | No |
| **MCP config path** | `~/.claude/.mcp.json` | Check docs | — | — | — |

All instruction files are identical copies of `INSTRUCTIONS.md` (synced via `npm run sync:instructions`). The core n8n knowledge is the same regardless of which agent reads it.

### Install Skills (Claude Code + Codex)

The `skills/n8n/` directory contains 8 expert n8n skills. They teach your agent how to write expressions, configure nodes, build workflow patterns, validate configurations, and write JavaScript/Python for n8n Code nodes.

Without skills, your agent still works using the instruction file alone. Skills make it significantly better at n8n-specific tasks.

**Claude Code — Windows:**
```cmd
xcopy /E /I skills\n8n\* "%USERPROFILE%\.claude\skills\"
```

**Claude Code — Mac/Linux:**
```bash
cp -r skills/n8n/* ~/.claude/skills/
```

**Codex — Windows:**
```cmd
xcopy /E /I skills\n8n\* "%USERPROFILE%\.agents\skills\"
```

**Codex — Mac/Linux:**
```bash
mkdir -p ~/.agents/skills
cp -r skills/n8n/* ~/.agents/skills/
```

**Both agents on same machine:** Run both sets of commands.

After copying, restart your agent (close and reopen the IDE, or restart the CLI).

**Verify:** Ask your agent "What n8n skills do you have?" — it should list the 8 skills.

### Set Up n8n MCP Server (Optional)

The n8n-mcp server gives your agent real-time access to documentation for 1,084 n8n nodes and 2,709 workflow templates. It also enables direct workflow management (create, update, validate, test) through MCP tools.

**Step 1:** Copy the MCP config template:
```bash
cp .mcp.json.example .mcp.json
```

**Step 2:** Edit `.mcp.json` and fill in your n8n details:
```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["n8n-mcp"],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true",
        "N8N_API_URL": "https://your-n8n-instance.app.n8n.cloud",
        "N8N_API_KEY": "your-n8n-api-key-here"
      }
    }
  }
}
```

**Important notes:**
- `N8N_API_URL` — Your n8n instance URL (same as N8N_URL in .env, but without trailing slash)
- `N8N_API_KEY` — Same API key as in your .env file
- `MCP_MODE` must be `"stdio"`
- `LOG_LEVEL` and `DISABLE_CONSOLE_OUTPUT` prevent log noise from breaking the MCP protocol
- `.mcp.json` is gitignored — your credentials stay local

**Step 3:** Install the MCP config for your agent:

| Agent | Where to put `.mcp.json` |
|-------|-------------------------|
| Claude Code | Project root (already there) or `~/.claude/.mcp.json` (global) |
| Codex | Check Codex docs for MCP config location |
| Cursor/Windsurf/Copilot | MCP not currently supported |

**Step 4:** Restart your agent.

**Test it:** Ask your agent "search for the Gmail node in n8n". If MCP is working, it will use the `search_nodes` tool and return detailed node documentation.

### Cursor / Windsurf / Copilot / Other

These agents work out of the box — no extra setup needed:

1. Open this project folder in your IDE
2. The AI assistant automatically reads its instruction file (`.cursorrules`, `.windsurfrules`, or `.github/copilot-instructions.md`)
3. Use the npm scripts from the integrated terminal
4. Skills and MCP are not currently supported by these agents — the instruction file contains comprehensive n8n knowledge

---

## Phase 6: Verify Everything Works

Run this checklist with the user:

### Quick Test

```bash
# 1. Pull workflows (tests API connection)
npm run pull

# 2. Check that workflows appeared in the workflows/ folder
ls workflows/

# 3. Validate all pulled workflows
npm run validate:all
```

### Create a Test Workflow (Optional)

If they want to verify the full create-push cycle, guide them to ask their AI agent:

> "Create a simple test workflow with a Manual Trigger and a Set node that outputs {hello: 'world'}. Push it to my n8n instance."

The agent should:
1. Create a JSON file in `workflows/`
2. Validate it with `npm run validate`
3. Push it with `npm run push`
4. The workflow should appear in their n8n UI

---

## Phase 7: Explain How to Use It

Once setup is complete, explain the daily workflow:

### Creating Workflows

"Just describe what you want in plain language. For example:
- 'Create a workflow that checks my website uptime every hour and sends me a Slack message if it's down'
- 'Build a workflow that syncs new Google Sheets rows to my database'
- 'Make a workflow that receives webhooks from Stripe and logs payments'

Your AI agent will research the right n8n nodes, build the workflow JSON, validate it, and push it to your n8n instance."

### Managing Workflows

| Command | What it does |
|---------|-------------|
| `npm run pull` | Download all workflows from n8n to `workflows/` |
| `npm run push workflows/file.json` | Upload a workflow to n8n |
| `npm run validate workflows/file.json` | Check a workflow for errors |
| `npm run validate:all` | Check all workflows |
| `npm run run -- <id> --input data.json` | Trigger a webhook workflow |
| `npm run execute -- <id> --wait` | Execute a workflow and show results |

### Keeping Instruction Files in Sync

If you or your agent edits `INSTRUCTIONS.md`, run `npm run sync:instructions` to propagate changes to all agent-specific files (CLAUDE.md, AGENTS.md, .cursorrules, etc.).

### Version Control

"Your workflows are stored as JSON files in `workflows/`. Use git to track changes:
```bash
git add workflows/
git commit -m 'Add new uptime monitor workflow'
```
This gives you full history of every workflow change — something n8n alone doesn't provide."

---

## Troubleshooting

If the user hits issues at any point:

### "npm run pull shows 0 workflows"
- They may not have any workflows yet — that's normal for a fresh n8n instance
- Check that the API key has proper permissions

### "Command not found: node"
- Node.js isn't installed or not in PATH
- On Windows: restart the terminal after installing Node.js

### "Cannot find module 'dotenv'"
- Run `npm install` in the project directory

### ".env file not found" or "Missing N8N_API_KEY"
- Make sure they copied `.env.example` to `.env` and filled in the values
- The `.env` file should be in the project root, not in a subfolder

### Skills not loading

| Agent | Skills directory | File per skill |
|-------|-----------------|----------------|
| Claude Code | `~/.claude/skills/<name>/` | `SKILL.md` |
| Codex | `~/.agents/skills/<name>/` | `SKILL.md` |

- Each skill needs its own subfolder with a `SKILL.md` file inside
- Restart your agent after adding skills
- The skills source is in `skills/n8n/` — copy the contents, not the `n8n/` folder itself

### MCP server not connecting
- Check that `.mcp.json` exists in the project root (copy from `.mcp.json.example`)
- Make sure `N8N_API_URL` does NOT have a trailing slash
- Make sure `MCP_MODE` is set to `"stdio"`
- `LOG_LEVEL` must be `"error"` and `DISABLE_CONSOLE_OUTPUT` must be `"true"` — other values can break the MCP protocol
- Restart your agent after changing MCP config
- Try running `npx n8n-mcp` manually in your terminal to check if the package installs correctly

### Instruction files out of sync
- Run `npm run sync:instructions` to re-sync all agent files from INSTRUCTIONS.md

---

## Summary

After setup is complete, the user has:

1. **A local project** connected to their n8n instance via API
2. **Pull/push scripts** to sync workflows between local files and n8n
3. **Validation** to catch errors before pushing
4. **An AI agent** that can create n8n workflows from natural language
5. **Git version control** for all workflow changes
6. **(Optional) Skills** that make their agent an n8n expert
7. **(Optional) MCP server** for real-time node documentation and workflow management

They can now describe any automation they want, and their AI agent will build it.
