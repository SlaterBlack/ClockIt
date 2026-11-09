const assert = require('node:assert/strict');
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createSiteServer } = require('../src/site-server.cjs');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

test('serves the frontend and proxies API requests with the /api prefix intact', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai3d-site-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'static'));
  await writeFile(path.join(directory, 'static', 'index.html'), '<main>Launcher test page</main>');
  const api = http.createServer((request, response) => {
    response.end(request.url);
  });
  api.listen(0, '127.0.0.1');
  await listen(api);
  const apiPort = api.address().port;

  const site = createSiteServer({
    appName: 'ClockIt',
    apiUrl: `http://127.0.0.1:${apiPort}`,
    frontendHost: '127.0.0.1',
    frontendPort: 0,
  }, path.join(directory, 'static'));
  try {
    await listen(site);
    const port = site.address().port;
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Launcher test page/);

    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/health?ready=1`);
    assert.equal(apiResponse.status, 200);
    assert.equal(await apiResponse.text(), '/api/health?ready=1');
  } finally {
    await Promise.all([close(site), close(api)]);
  }
});

test('fails explicitly when the frontend build is missing', () => {
  assert.throws(
    () => createSiteServer({ appName: 'ClockIt' }, '/missing/launcher-frontend'),
    /Built frontend was not found/,
  );
});
