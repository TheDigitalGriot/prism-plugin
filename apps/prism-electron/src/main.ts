import { app, BrowserWindow, Menu, utilityProcess } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { ElectronIPCBridge } from './hosts/electron/ElectronIPCBridge';
import { loadWindowState, saveWindowState } from './window-state';
import { DaemonManager, type ForkedChild } from './daemon/daemon-manager';
import {
  resolveDaemonDist,
  resolveBrokerEntry,
  resolveConfigPath,
  readExpectedVersion,
} from './daemon/runtime-paths';

// Handle Squirrel install/uninstall on Windows
if (started) app.quit();

let bridge: ElectronIPCBridge | null = null;
let daemonManager: DaemonManager | null = null;
let isQuitting = false;

/** App-global broker supervisor (one daemon for all windows). Lazily constructed. */
function getDaemonManager(): DaemonManager {
  if (daemonManager) return daemonManager;
  const daemonDist = resolveDaemonDist({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appRoot: app.getAppPath(),
  });
  daemonManager = new DaemonManager({
    // Electron's built-in Node child — no external node needed.
    fork: (entry, _args, opts) => {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts.env)) if (v !== undefined) env[k] = v;
      return utilityProcess.fork(entry, [], { env, serviceName: 'prism-daemon' }) as unknown as ForkedChild;
    },
    fetchFn: (input, init) => fetch(input, init),
    brokerEntry: resolveBrokerEntry(daemonDist),
    configPath: resolveConfigPath(daemonDist),
    port: Number(process.env.PRISM_DAEMON_PORT ?? 6780),
    expectedVersion: readExpectedVersion(daemonDist),
    log: (msg, ...rest) => console.log('[prism-daemon]', msg, ...rest),
  });
  return daemonManager;
}

function createWindow() {
  // Restore last window bounds (falls back to 1200×800 if no saved state)
  const state = loadWindowState();

  const mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Wire Prism controller + daemon supervisor to this window
  bridge = new ElectronIPCBridge(mainWindow, getDaemonManager());

  // Restore last project or open from CLI argument
  // Packaged: argv[0] = exe path, user args start at 1
  // Dev:      argv[0] = electron, argv[1] = entry script, user args start at 2
  const userArgs = process.argv.slice(app.isPackaged ? 1 : 2);
  const cliArg = userArgs.find(a => !a.startsWith('-') && fs.existsSync(a));
  const initialDir = cliArg ?? state.lastProjectDir;
  if (initialDir) {
    void bridge.setProjectDir(initialDir);
  }

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/webview-ui/index.html`),
    );
  }

  // DevTools in development only
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Save window state before the window is destroyed
  mainWindow.on('close', () => {
    saveWindowState(mainWindow, bridge?.currentProjectDir);
  });

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
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      { label: 'View', role: 'viewMenu' },
      { label: 'Window', role: 'windowMenu' },
    ]),
  );
}

app.on('ready', () => {
  // Eager start: the broker is the shared spine. Crash-restart + health loop
  // (inside DaemonManager) handle resilience.
  void getDaemonManager().start();
  createWindow();
});

// Kill the broker on quit — but only the one WE started (adopted brokers are
// left alive). stop() is synchronous, so no async quit dance is needed.
app.on('before-quit', (event) => {
  if (isQuitting || !daemonManager) return;
  const status = daemonManager.getStatus();
  if (status.adopted || status.status === 'stopped') return;
  event.preventDefault();
  isQuitting = true;
  daemonManager.stop();
  app.quit();
});

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
