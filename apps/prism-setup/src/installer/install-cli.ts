import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';
import type { InstallProgress } from '../types';
import { getPlatformString, getPrismDir, getWorkspacesPath } from './paths';
import { configurePath, removeFromPath } from './path-config';

function sendProgress(
  onProgress: (p: InstallProgress) => void,
  partial: Partial<InstallProgress>,
) {
  onProgress({
    componentId: 'prism-cli',
    status: 'pending',
    percent: 0,
    message: '',
    ...partial,
  } as InstallProgress);
}

/** Get the path to bundled resources (works in both dev and packaged mode) */
function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  // In dev mode, resources are in the project directory
  return path.join(__dirname, '..', '..', 'resources');
}

export async function installPrismCli(options: {
  installDir: string;
  addToPath: boolean;
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  const { installDir, addToPath, onProgress } = options;

  // 1. Determine platform binary name
  sendProgress(onProgress, { status: 'installing', percent: 10, message: 'Locating binary...' });
  const ext = process.platform === 'win32' ? '.exe' : '';
  const binaryName = `prism-cli-${getPlatformString()}${ext}`;
  const src = path.join(getResourcesPath(), 'binaries', binaryName);

  if (!fs.existsSync(src)) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: `Binary not found: ${binaryName}`,
      error: `Resource file missing at ${src}. Run scripts/prepare-resources.sh first.`,
    });
    return;
  }

  // 2. Copy binary to installDir
  sendProgress(onProgress, { status: 'installing', percent: 30, message: 'Copying binary...' });
  const destName = process.platform === 'win32' ? 'prism-cli.exe' : 'prism-cli';
  const dest = path.join(installDir, destName);
  fs.mkdirSync(installDir, { recursive: true });
  fs.copyFileSync(src, dest);

  // 3. Make executable (Unix)
  if (process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }

  // 4. Configure PATH
  if (addToPath) {
    sendProgress(onProgress, { status: 'configuring', percent: 60, message: 'Configuring PATH...' });
    await configurePath(installDir);
  }

  // 5. Initialize workspaces.json
  sendProgress(onProgress, { status: 'configuring', percent: 80, message: 'Initializing workspaces...' });
  initWorkspaces();

  // 6. Verify
  sendProgress(onProgress, { status: 'verifying', percent: 90, message: 'Verifying installation...' });
  if (!fs.existsSync(dest)) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Verification failed',
      error: `Binary not found at ${dest} after copy`,
    });
    return;
  }

  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Prism CLI installed successfully' });
}

export async function uninstallPrismCli(
  installDir: string,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  // 1. Remove binary
  sendProgress(onProgress, { status: 'installing', percent: 20, message: 'Removing binary...' });
  const destName = process.platform === 'win32' ? 'prism-cli.exe' : 'prism-cli';
  const binary = path.join(installDir, destName);
  if (fs.existsSync(binary)) {
    fs.unlinkSync(binary);
  }

  // 2. Remove from PATH
  sendProgress(onProgress, { status: 'configuring', percent: 60, message: 'Cleaning PATH...' });
  await removeFromPath(installDir);

  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Prism CLI removed' });
}

function initWorkspaces(): void {
  const prismDir = getPrismDir();
  const wsFile = getWorkspacesPath();
  fs.mkdirSync(path.join(prismDir, 'bin'), { recursive: true });
  if (!fs.existsSync(wsFile)) {
    fs.writeFileSync(wsFile, '{"projects":[]}', 'utf-8');
  }
}
