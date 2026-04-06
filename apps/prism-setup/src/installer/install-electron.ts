import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';
import type { InstallProgress, ReleaseAsset } from '../types';
import { getLatestRelease } from './version';
import { downloadFile } from './download';

function sendProgress(
  onProgress: (p: InstallProgress) => void,
  partial: Partial<InstallProgress>,
) {
  onProgress({
    componentId: 'prism-electron',
    status: 'pending',
    percent: 0,
    message: '',
    ...partial,
  } as InstallProgress);
}

/** Determine the expected asset name for the current platform */
function getElectronAssetName(): string {
  const platform = process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

  if (platform === 'win32') {
    return `Prism-Setup.exe`; // or Prism-${version}-Setup.exe
  } else if (platform === 'darwin') {
    return `Prism-darwin-${arch}.zip`;
  } else {
    return `Prism-linux-${arch}.AppImage`;
  }
}

/** Find the matching asset from a release, with fuzzy matching */
function findAsset(assets: ReleaseAsset[], targetName: string): ReleaseAsset | undefined {
  // Exact match first
  const exact = assets.find(a => a.name === targetName);
  if (exact) return exact;

  // Fuzzy match: look for platform-specific keywords
  const platform = process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

  return assets.find(a => {
    const name = a.name.toLowerCase();
    if (platform === 'win32') return name.includes('setup') && name.endsWith('.exe');
    if (platform === 'darwin') return name.includes('darwin') && name.includes(arch);
    return name.includes('linux') && (name.endsWith('.appimage') || name.endsWith('.deb'));
  });
}

export async function installElectronApp(options: {
  onProgress: (p: InstallProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { onProgress, signal } = options;

  // 1. Get latest release info
  sendProgress(onProgress, { status: 'downloading', percent: 5, message: 'Checking latest release...' });
  let release: { version: string; assets: ReleaseAsset[] };
  try {
    release = await getLatestRelease();
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Failed to check releases',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 2. Find the matching asset
  const targetName = getElectronAssetName();
  const asset = findAsset(release.assets, targetName);
  if (!asset) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: `No installer found for ${process.platform}/${process.arch}`,
      error: `Expected asset "${targetName}" not found in release v${release.version}. Available: ${release.assets.map(a => a.name).join(', ') || 'none'}`,
    });
    return;
  }

  // 3. Download to temp directory
  const tempDir = path.join(app.getPath('temp'), 'prism-setup');
  fs.mkdirSync(tempDir, { recursive: true });
  const destPath = path.join(tempDir, asset.name);

  try {
    await downloadFile({
      url: asset.browser_download_url,
      destPath,
      signal,
      onProgress: (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 80) + 10 : -1;
        const mb = (downloaded / 1024 / 1024).toFixed(1);
        const totalMb = total > 0 ? (total / 1024 / 1024).toFixed(1) : '?';
        sendProgress(onProgress, {
          status: 'downloading',
          percent,
          message: `Downloading... ${mb} / ${totalMb} MB`,
        });
      },
    });
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Download failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 4. Run platform-specific installer
  sendProgress(onProgress, { status: 'installing', percent: 92, message: 'Running installer...' });
  try {
    if (process.platform === 'win32') {
      execSync(`"${destPath}" /S`, { timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
    } else if (process.platform === 'darwin') {
      execSync(`unzip -o "${destPath}" -d /tmp/prism-app`, { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
      execSync('mv /tmp/prism-app/Prism.app /Applications/Prism.app', { stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      // Linux: AppImage — copy to ~/.local/bin/
      const appImageDest = path.join(os.homedir(), '.local', 'bin', 'Prism.AppImage');
      fs.mkdirSync(path.dirname(appImageDest), { recursive: true });
      fs.copyFileSync(destPath, appImageDest);
      fs.chmodSync(appImageDest, 0o755);
    }
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Installation failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 5. Cleanup temp
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Non-critical
  }

  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Prism Desktop App installed' });
}

export async function uninstallElectronApp(
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  sendProgress(onProgress, { status: 'installing', percent: 30, message: 'Removing desktop app...' });

  try {
    if (process.platform === 'win32') {
      // Squirrel uninstaller
      const appDir = path.join(process.env.LOCALAPPDATA ?? '', 'Prism');
      const uninstaller = path.join(appDir, 'Update.exe');
      if (fs.existsSync(uninstaller)) {
        execSync(`"${uninstaller}" --uninstall`, { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
      }
    } else if (process.platform === 'darwin') {
      const appPath = '/Applications/Prism.app';
      if (fs.existsSync(appPath)) {
        fs.rmSync(appPath, { recursive: true, force: true });
      }
    } else {
      const appImagePath = path.join(os.homedir(), '.local', 'bin', 'Prism.AppImage');
      if (fs.existsSync(appImagePath)) {
        fs.unlinkSync(appImagePath);
      }
    }
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Uninstall failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Desktop app removed' });
}
