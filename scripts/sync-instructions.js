#!/usr/bin/env node

/**
 * Syncs INSTRUCTIONS.md (canonical source) to all agent-specific instruction files.
 *
 * Agent file mapping:
 *   CLAUDE.md                      - Claude Code (CLI + VS Code)
 *   AGENTS.md                      - Codex (CLI + Desktop)
 *   .cursorrules                   - Cursor
 *   .windsurfrules                 - Windsurf
 *   .github/copilot-instructions.md - GitHub Copilot
 *
 * Usage:
 *   node scripts/sync-instructions.js
 *   npm run sync:instructions
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'INSTRUCTIONS.md');

const TARGETS = [
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.windsurfrules',
  '.github/copilot-instructions.md',
];

function sync() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Error: INSTRUCTIONS.md not found in project root.');
    process.exit(1);
  }

  const content = fs.readFileSync(SOURCE, 'utf-8');
  let updated = 0;

  for (const target of TARGETS) {
    const targetPath = path.join(ROOT, target);
    const targetDir = path.dirname(targetPath);

    // Create directory if needed (e.g. .github/)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check if content differs
    const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf-8') : '';
    if (existing === content) {
      console.log(`  [skip] ${target} (already up to date)`);
      continue;
    }

    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`  [sync] ${target}`);
    updated++;
  }

  console.log(`\nDone. ${updated} file(s) updated, ${TARGETS.length - updated} already current.`);
}

sync();
