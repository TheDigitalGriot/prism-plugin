import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import { getSystemInfo } from './installer/detect';
import { getLatestRelease } from './installer/version';
import { InstallerOrchestrator } from './installer/orchestrator';
import type { InstallOptions, ComponentId } from './types';

let mainWindow: BrowserWindow | null = null;
let activeOrchestrator: InstallerOrchestrator | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
};

// --- IPC Handlers ---

ipcMain.handle('setup:getSystemInfo', async () => {
  return getSystemInfo();
});

ipcMain.handle('setup:startInstall', async (event, options: InstallOptions) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  activeOrchestrator = new InstallerOrchestrator(win);
  await activeOrchestrator.install(options);
  activeOrchestrator = null;
});

ipcMain.handle('setup:startUninstall', async (event, components: ComponentId[]) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  activeOrchestrator = new InstallerOrchestrator(win);
  await activeOrchestrator.uninstall(components);
  activeOrchestrator = null;
});

ipcMain.on('setup:cancelInstall', () => {
  activeOrchestrator?.cancel();
});

ipcMain.handle('setup:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('setup:selectDirectory', async (_event, defaultPath: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('setup:getLatestVersion', async () => {
  try {
    return await getLatestRelease();
  } catch (err) {
    console.warn('Failed to fetch latest version:', err);
    return { version: '2.4.5', assets: [] };
  }
});

// --- App Lifecycle ---

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
