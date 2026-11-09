const path = require('node:path');

const appKind = 'clockit';
const appName = 'ClockIt';
const publicDirectory = path.resolve(__dirname, '../frontend/public');

module.exports = {
  appId: `com.ai3d.${appKind}.launcher`,
  productName: appName,
  executableName: appKind,
  extraMetadata: { launcherApp: appKind, desktopName: appName },
  directories: {
    output: `release/${appKind}`,
  },
  files: ['src/**/*', 'package.json'],
  extraResources: [
    {
      from: path.resolve(__dirname, '../frontend/dist/frontend/browser'),
      to: 'site',
    },
    {
      from: path.join(publicDirectory, `${appName}Logo_32x32.png`),
      to: 'tray.png',
    },
    {
      from: path.join(publicDirectory, `${appName}Logo.ico`),
      to: 'app.ico',
    },
    {
      from: path.join(publicDirectory, `${appName}Logo_512x512.png`),
      to: 'app.png',
    },
  ],
  asar: true,
  win: {
    target: ['portable'],
    icon: path.join(publicDirectory, `${appName}Logo_512x512.png`),
  },
  linux: {
    target: ['AppImage'],
    category: 'Utility',
    icon: path.join(publicDirectory, `${appName}Logo_512x512.png`),
    syncDesktopName: true,
  },
};
