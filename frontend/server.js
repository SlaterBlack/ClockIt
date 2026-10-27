// Minimal production server for the ClockIt frontend.
// Serves the Angular production build and reverse-proxies /api to the
// StoreIt backend so only this one port needs to be exposed/forwarded.
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const PORT = Number(process.env.FRONTEND_PORT || 2400);
const HOST = process.env.FRONTEND_HOST || '0.0.0.0';
const API_TARGET = process.env.STOREIT_API_URL || 'http://127.0.0.1:4002';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH?.trim();
const TLS_KEY_PATH = process.env.TLS_KEY_PATH?.trim();
const BROWSER_DIR = path.join(__dirname, 'dist', 'frontend', 'browser');

if (Boolean(TLS_CERT_PATH) !== Boolean(TLS_KEY_PATH)) {
  throw new Error('Set both TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS.');
}

const app = express();

app.use(
  '/api',
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    // app.use('/api', ...) strips the mount path from req.url before the
    // proxy sees it, so restore the /api prefix for the upstream request.
    pathRewrite: (path) => `/api${path}`,
  }),
);
app.use(express.static(BROWSER_DIR));

// Client-side routing fallback: any non-API, non-file GET serves index.html.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(BROWSER_DIR, 'index.html'));
});

if (TLS_CERT_PATH && TLS_KEY_PATH) {
  const server = https.createServer(
    {
      cert: fs.readFileSync(TLS_CERT_PATH),
      key: fs.readFileSync(TLS_KEY_PATH),
    },
    app,
  );
  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`ClockIt frontend listening on https://${HOST}:${PORT}, proxying /api to ${API_TARGET}`);
  });
} else {
  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`ClockIt frontend listening on http://${HOST}:${PORT}, proxying /api to ${API_TARGET}`);
  });
}
