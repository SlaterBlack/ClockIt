const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } = require('electron');
const { launcherApp } = require('../package.json');
const {
  APP_DEFAULTS,
  browserUrl,
  defaultsFor,
  serializeSettings,
  settingsFileFor,
  settingsFromEnvFile,
  validateSettings,
} = require('./settings.cjs');
const { createSiteServer } = require('./site-server.cjs');
const { mkdir, writeFile } = require('node:fs/promises');

const appKind = launcherApp || process.env.LAUNCHER_APP;
const appDefaults = APP_DEFAULTS[appKind];
if (!appDefaults) {
  throw new Error('Launcher application is not configured. Package it with LAUNCHER_APP=clockit or manageit.');
}

const appName = appDefaults.name;
const userDataDirectory = path.join(app.getPath('appData'), `${appName} Launcher`);
app.setPath('userData', userDataDirectory);
const settingsPath = settingsFileFor(userDataDirectory);
const siteDirectory = app.isPackaged
  ? path.join(process.resourcesPath, 'site')
  : process.env.LAUNCHER_SITE_DIR || defaultSiteDirectory();

let mainWindow;
let tray;
let siteServer;
let currentSettings;
let currentError = null;
let isQuitting = false;

function defaultSiteDirectory() {
  return path.resolve(__dirname, '../../frontend/dist/frontend/browser');
}

function networkAddresses() {
  const addresses = [];
  for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      const family = typeof entry.family === 'string' ? entry.family : Number(entry.family) === 4 ? 'IPv4' : 'IPv6';
      if (family === 'IPv4' && !entry.internal) {
        addresses.push({ address: entry.address, interfaceName });
      }
    }
  }
  return addresses;
}

function publicUrls(settings) {
  if (!settings || !siteServer) return [];
  if (settings.frontendHost === '127.0.0.1' || settings.frontendHost === 'localhost' || settings.frontendHost === '::1') {
    return [browserUrl(settings)];
  }
  if (settings.frontendHost !== '0.0.0.0') {
    return [browserUrl(settings)];
  }
  return [
    browserUrl(settings),
    ...networkAddresses().map(({ address }) => `http://${address}:${settings.frontendPort}/`),
  ];
}

function stateSnapshot() {
  return {
    appName,
    appKind,
    iconDataUrl: nativeImage.createFromPath(trayIconPath()).toDataURL(),
    running: Boolean(siteServer),
    error: currentError,
    settings: currentSettings ?? defaultsFor(appKind),
    settingsPath,
    networkAddresses: networkAddresses(),
    urls: publicUrls(currentSettings),
  };
}

function publishState() {
  const state = stateSnapshot();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('launcher:state', state);
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const state = stateSnapshot();
  tray.setToolTip(`${appName} — ${state.running ? 'Running' : 'Stopped'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: `Open ${appName}`,
      enabled: state.running,
      click: () => openApp(),
    },
    {
      label: state.running ? `Stop ${appName}` : `Start ${appName}`,
      click: () => (state.running ? stopSite() : startSite(currentSettings ?? defaultsFor(appKind))),
    },
    { type: 'separator' },
    { label: 'Settings', click: () => showWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => quitApplication() },
  ]));
}

function trayIconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'tray.png');
  return path.resolve(__dirname, '../../frontend/public/ClockItLogo_32x32.png');
}

function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath());
  if (icon.isEmpty()) {
    throw new Error(`Could not load ${appName} tray icon from ${trayIconPath()}.`);
  }
  tray = new Tray(icon);
  tray.on('click', () => showWindow());
  tray.on('double-click', () => openApp());
  updateTrayMenu();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 760,
    minWidth: 620,
    minHeight: 650,
    title: `${appName} Launcher`,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: appKind === 'clockit' ? '#f9f6f0' : '#faf4e9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('launcher:state', stateSnapshot());
  });
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function writeSettings(settings) {
  await mkdir(userDataDirectory, { recursive: true });
  await writeFile(settingsPath, serializeSettings(settings), { encoding: 'utf8', mode: 0o600 });
}

async function startSite(input) {
  const settings = validateSettings(input, appKind);
  if (siteServer) {
    await stopSite();
  }
  currentError = null;
  await writeSettings(settings);

  const server = createSiteServer(settings, siteDirectory);
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  } catch (error) {
    server.close();
    throw new Error(`Could not start ${appName} on ${settings.frontendHost}:${settings.frontendPort}: ${error.message}`);
  }

  siteServer = server;
  currentSettings = settings;
  publishState();
  await shell.openExternal(browserUrl(settings));
  return stateSnapshot();
}

async function stopSite() {
  if (!siteServer) {
    publishState();
    return stateSnapshot();
  }

  const server = siteServer;
  siteServer = undefined;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  currentError = null;
  publishState();
  return stateSnapshot();
}

async function openApp() {
  if (!siteServer || !currentSettings) {
    return { ok: false, error: `${appName} is not running.` };
  }
  try {
    await shell.openExternal(browserUrl(currentSettings));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not open the browser: ${error.message}` };
  }
}

async function quitApplication() {
  isQuitting = true;
  try {
    await stopSite();
  } catch (error) {
    console.error(`Could not stop ${appName} cleanly: ${error.message}`);
  }
  if (tray) tray.destroy();
  app.quit();
}

ipcMain.handle('launcher:get-initial-state', async () => {
  try {
    currentSettings = settingsFromEnvFile(settingsPath, appKind);
  } catch (error) {
    currentError = error.message;
  }
  return stateSnapshot();
});

ipcMain.handle('launcher:start', async (_event, input) => {
  try {
    const state = await startSite(input);
    return { ok: true, state };
  } catch (error) {
    currentError = error.message;
    publishState();
    return { ok: false, error: currentError, state: stateSnapshot() };
  }
});

ipcMain.handle('launcher:stop', async () => {
  try {
    return { ok: true, state: await stopSite() };
  } catch (error) {
    currentError = error.message;
    publishState();
    return { ok: false, error: currentError, state: stateSnapshot() };
  }
});

ipcMain.handle('launcher:open-app', openApp);
ipcMain.on('launcher:hide', () => mainWindow?.hide());

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(async () => {
    createWindow();
    createTray();
    showWindow();
    try {
      currentSettings = settingsFromEnvFile(settingsPath, appKind);
      await startSite(currentSettings);
    } catch (error) {
      currentError = error.message;
      publishState();
    }
  }).catch((error) => {
    console.error(`Failed to initialize ${appName} launcher: ${error.message}`);
    app.quit();
  });
}

app.on('before-quit', (event) => {
  if (!isQuitting && siteServer) {
    event.preventDefault();
    void quitApplication();
  }
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
