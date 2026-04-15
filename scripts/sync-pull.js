const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('node', ['n8n-manager.js', 'pull']);
run('node', ['validate-workflow.js', '--all']);
