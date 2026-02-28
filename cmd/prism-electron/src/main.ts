import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ElectronIPCBridge } from './hosts/electron/ElectronIPCBridge';

// Handle Squirrel install/uninstall on Windows
if (started) app.quit();

let bridge: ElectronIPCBridge | null = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Wire Prism controller to this window
  bridge = new ElectronIPCBridge(mainWindow);

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    bridge?.dispose();
    bridge = null;
  });

  // Native application menu
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'Open Project\u2026',
            accelerator: 'CmdOrCtrl+O',
            click: () => { void bridge?.openProject(); },
          },
          { type: 'separator' },
          { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
        ],
      },
      { label: 'Edit', role: 'editMenu' },
      { label: 'View', role: 'viewMenu' },
      { label: 'Window', role: 'windowMenu' },
    ]),
  );
}

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
