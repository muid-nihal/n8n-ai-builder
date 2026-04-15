const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function getChangedWorkflowFiles() {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const files = [];
  for (const line of lines) {
    const file = line.slice(3);
    if (!file.startsWith('workflows/')) continue;
    if (!file.endsWith('.json')) continue;
    files.push(file);
  }
  return [...new Set(files)];
}

const files = getChangedWorkflowFiles();

if (files.length === 0) {
  console.log('No changed workflow files to push.');
  process.exit(0);
}

// Validate only changed files
run('node', ['validate-workflow.js', ...files]);

// Push only changed files
for (const file of files) {
  run('node', ['n8n-manager.js', 'push', file]);
}
