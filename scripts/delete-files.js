const fs = require('fs');
const path = require('path');

// Usage: node scripts/delete-files.js <file1> <file2> ...
// Reliably deletes files using Node.js fs.unlinkSync

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/delete-files.js <file1> [file2] ...');
  console.log('  Paths can be absolute or relative to project root.');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');
let deleted = 0;
let failed = 0;

for (const arg of args) {
  const fp = path.isAbsolute(arg) ? arg : path.join(rootDir, arg);
  try {
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      console.log('Deleted: ' + path.relative(rootDir, fp));
      deleted++;
    } else {
      console.log('Not found: ' + path.relative(rootDir, fp));
    }
  } catch (e) {
    console.log('Failed: ' + path.relative(rootDir, fp) + ' - ' + e.message);
    failed++;
  }
}

console.log('\nDone. Deleted: ' + deleted + (failed ? ', Failed: ' + failed : ''));
