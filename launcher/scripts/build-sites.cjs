const { spawnSync } = require('node:child_process');
const path = require('node:path');

const frontendDirectory = path.resolve(__dirname, '../../frontend');
for (const [step, args] of [
  ['dependency installation', ['ci']],
  ['frontend build', ['run', 'build']],
]) {
  const result = spawnSync('npm', args, {
    cwd: frontendDirectory,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`Could not start ClockIt ${step}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`ClockIt ${step} failed.`);
    process.exit(result.status ?? 1);
  }
}
