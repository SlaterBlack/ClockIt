const { spawnSync } = require('node:child_process');
const path = require('node:path');

const appKind = process.argv[2];
if (!['clockit', 'manageit'].includes(appKind)) {
  console.error('Usage: node scripts/dev.cjs <clockit|manageit>');
  process.exit(2);
}

const electronPath = require('electron');
const result = spawnSync(electronPath, ['.'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, LAUNCHER_APP: appKind },
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Could not start the Electron launcher: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
