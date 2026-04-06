export type Platform = 'win32' | 'darwin' | 'linux';
export type Arch = 'x64' | 'arm64';

export type ComponentId = 'prism-cli' | 'prism-vscode' | 'prism-electron' | 'claude-plugin';

export type ComponentStatus = {
  id: ComponentId;
  name: string;
  description: string;
  installed: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  prerequisiteMet: boolean;
  prerequisiteMessage: string | null;
};

export type SystemInfo = {
  platform: Platform;
  arch: Arch;
  homedir: string;
  vscodeAvailable: boolean;
  vscodePath: string | null;
  cursorAvailable: boolean;
  windsurfAvailable: boolean;
  claudeAvailable: boolean;
  claudePath: string | null;
  nodeAvailable: boolean;
  goAvailable: boolean;
  existingPrismDir: boolean;
  components: ComponentStatus[];
};

export type InstallProgress = {
  componentId: ComponentId;
  status: 'pending' | 'downloading' | 'installing' | 'configuring' | 'verifying' | 'complete' | 'error' | 'skipped';
  percent: number;
  message: string;
  error?: string;
};

export type InstallOptions = {
  components: ComponentId[];
  installDir: string;
  addToPath: boolean;
  editor: 'vscode' | 'cursor' | 'windsurf' | null;
};

export type WizardMode = 'install' | 'update' | 'uninstall';

export interface SetupAPI {
  getSystemInfo: () => Promise<SystemInfo>;
  startInstall: (options: InstallOptions) => Promise<void>;
  startUninstall: (components: ComponentId[]) => Promise<void>;
  cancelInstall: () => void;
  onProgress: (cb: (progress: InstallProgress) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
  selectDirectory: (defaultPath: string) => Promise<string | null>;
  getLatestVersion: () => Promise<{ version: string; assets: ReleaseAsset[] }>;
}

export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

declare global {
  interface Window {
    setupAPI: SetupAPI;
  }
}
