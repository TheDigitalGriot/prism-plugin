import path from 'node:path';
import os from 'node:os';

const homedir = os.homedir();

/** ~/.prism/ */
export function getPrismDir(): string {
  return path.join(homedir, '.prism');
}

/** ~/.prism/bin/ */
export function getPrismBinDir(): string {
  return path.join(getPrismDir(), 'bin');
}

/** ~/.prism/bin/prism-cli or prism-cli.exe */
export function getPrismCliBinaryPath(): string {
  const binary = process.platform === 'win32' ? 'prism-cli.exe' : 'prism-cli';
  return path.join(getPrismBinDir(), binary);
}

/** ~/.prism/workspaces.json */
export function getWorkspacesPath(): string {
  return path.join(getPrismDir(), 'workspaces.json');
}

/** ~/.claude/ */
export function getClaudeDir(): string {
  return path.join(homedir, '.claude');
}

/** ~/.claude/plugins/cache/prism-marketplace/prism/ */
export function getClaudePluginCacheDir(): string {
  return path.join(getClaudeDir(), 'plugins', 'cache', 'prism-marketplace', 'prism');
}

/** Platform-specific prism-electron install location */
export function getElectronAppPath(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.LOCALAPPDATA ?? path.join(homedir, 'AppData', 'Local'), 'Prism');
    case 'darwin':
      return '/Applications/Prism.app';
    default:
      return path.join(homedir, '.local', 'bin', 'Prism.AppImage');
  }
}

/** macOS app paths for editor detection */
export const MACOS_EDITOR_PATHS: Record<string, string> = {
  vscode: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
  cursor: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
  windsurf: '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf',
};

/** Platform string for binary naming: darwin-arm64, linux-amd64, windows-amd64 */
export function getPlatformString(): string {
  const plat = process.platform === 'win32' ? 'windows' : process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  return `${plat}-${arch}`;
}
