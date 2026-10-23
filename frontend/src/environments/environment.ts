export const environment = {
  production: true,
  // Relative so the app works from whatever host/IP/port it's served from;
  // server.js (see ../../server.js) proxies /api to the StoreIt backend on
  // the same origin so only one port needs to be forwarded externally.
  apiUrl: '/api/clockit',
  sharedApiUrl: '/api',
};
