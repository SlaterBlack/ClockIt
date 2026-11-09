const { spawnSync } = require('node:child_process');
const path = require('node:path');

const frontendDirectory = path.resolve(__dirname, '../../frontend');
const result = spawnSync('npm', ['run', 'build'], {
  cwd: frontendDirectory,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) {
  console.error(`Could not start the ClockIt frontend build: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('ClockIt frontend build failed.');
  process.exit(result.status ?? 1);
}
