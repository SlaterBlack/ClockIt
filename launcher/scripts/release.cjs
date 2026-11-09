const { spawnSync } = require('node:child_process');
const path = require('node:path');

const target = process.argv[2];
const targetArgs = {
  windows: ['--win', 'portable', '--x64'],
  linux: ['--linux', 'AppImage', '--x64'],
  all: ['--win', 'portable', '--linux', 'AppImage', '--x64'],
}[target];

if (!targetArgs) {
  console.error('Usage: node scripts/release.cjs <windows|linux|all>');
  process.exit(2);
}

const root = path.resolve(__dirname, '..');
const buildSites = spawnSync(process.execPath, [path.join(__dirname, 'build-sites.cjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (buildSites.error) {
  console.error(`Could not start frontend builds: ${buildSites.error.message}`);
  process.exit(1);
}
if (buildSites.status !== 0) {
  process.exit(buildSites.status ?? 1);
}

console.log(`\nPackaging ClockIt for ${target}...`);
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-builder', '--config', 'electron-builder.config.cjs', ...targetArgs],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);
if (result.error) {
  console.error(`Could not start ClockIt packaging: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
