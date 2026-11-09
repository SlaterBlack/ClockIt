const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  browserUrl,
  defaultsFor,
  serializeSettings,
  settingsFromEnvFile,
  validateSettings,
} = require('../src/settings.cjs');

test('uses the ClockIt frontend default', () => {
  assert.equal(defaultsFor('clockit').frontendPort, 2400);
  assert.throws(() => defaultsFor('manageit'), /Unknown launcher application/);
  assert.throws(() => defaultsFor('other'), /Unknown launcher application/);
});

test('validates settings and serializes an app-specific env file', () => {
  const settings = validateSettings({
    apiScheme: 'https',
    apiHost: 'storeit.example.test',
    apiPort: '443',
    frontendHost: '0.0.0.0',
    frontendPort: '2400',
  }, 'clockit');

  assert.equal(settings.apiUrl, 'https://storeit.example.test');
  assert.equal(settings.frontendPort, 2400);
  assert.equal(browserUrl(settings), 'http://127.0.0.1:2400/');
  assert.match(serializeSettings(settings), /STOREIT_API_URL="https:\/\/storeit\.example\.test"/);
  assert.match(serializeSettings(settings), /FRONTEND_HOST="0\.0\.0\.0"/);
});

test('rejects invalid ports, protocols, hosts, and listen addresses', () => {
  const valid = {
    apiScheme: 'http',
    apiHost: '127.0.0.1',
    apiPort: 4002,
    frontendHost: '127.0.0.1',
    frontendPort: 2400,
  };
  assert.throws(() => validateSettings({ ...valid, apiPort: 0 }, 'clockit'), /API port/);
  assert.throws(() => validateSettings({ ...valid, apiScheme: 'file' }, 'clockit'), /HTTP or HTTPS/);
  assert.throws(() => validateSettings({ ...valid, apiHost: 'host/path' }, 'clockit'), /hostname or IP/);
  assert.throws(() => validateSettings({ ...valid, frontendHost: 'not-an-ip' }, 'clockit'), /listen address/);
});

test('loads saved settings from dotenv format and reports malformed API URLs', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai3d-launcher-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, '.env');

  assert.equal(settingsFromEnvFile(envPath, 'clockit').frontendPort, 2400);
  await writeFile(envPath, 'STOREIT_API_URL="https://storeit.example.test:444"\nFRONTEND_HOST="10.0.0.5"\nFRONTEND_PORT=2500\n');
  const settings = settingsFromEnvFile(envPath, 'clockit');
  assert.equal(settings.apiScheme, 'https');
  assert.equal(settings.apiPort, 444);
  assert.equal(settings.frontendHost, '10.0.0.5');
  assert.equal(settings.frontendPort, 2500);
  assert.match(await readFile(envPath, 'utf8'), /STOREIT_API_URL/);

  await writeFile(envPath, 'STOREIT_API_URL="not a url"\n');
  assert.throws(() => settingsFromEnvFile(envPath, 'clockit'), /Saved StoreIt API URL is invalid/);
});
