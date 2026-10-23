// Minimal production server for the ClockIt frontend.
// Serves the Angular production build and reverse-proxies /api to the
// StoreIt backend so only this one port needs to be exposed/forwarded.
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const PORT = Number(process.env.FRONTEND_PORT || 2400);
const API_TARGET = process.env.STOREIT_API_URL || 'http://127.0.0.1:4002';
const BROWSER_DIR = path.join(__dirname, 'dist', 'frontend', 'browser');

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

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`ClockIt frontend listening on http://0.0.0.0:${PORT}, proxying /api to ${API_TARGET}`);
});
