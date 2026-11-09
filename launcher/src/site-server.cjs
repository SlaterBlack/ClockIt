const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

function createSiteServer(settings, staticDirectory) {
  const indexPath = path.join(staticDirectory, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Built frontend was not found at ${indexPath}. Reinstall or rebuild the launcher.`);
  }

  const app = express();
  app.use(
    '/api',
    createProxyMiddleware({
      target: settings.apiUrl,
      changeOrigin: true,
      pathRewrite: (requestPath) => `/api${requestPath}`,
      on: {
        error(error, _request, response) {
          console.error(`[${settings.appName}] StoreIt API proxy error: ${error.message}`);
          if (!response.headersSent) {
            response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
          }
          response.end('Could not reach the StoreIt API. Check its address and port in launcher settings.');
        },
      },
    }),
  );
  app.use(express.static(staticDirectory));
  app.get(/.*/, (_request, response) => response.sendFile(indexPath));

  return app.listen(settings.frontendPort, settings.frontendHost);
}

module.exports = { createSiteServer };
