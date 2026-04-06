import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { InstallProgress } from '../types';
import { MACOS_EDITOR_PATHS } from './paths';

type EditorVariant = 'vscode' | 'cursor' | 'windsurf';

function getResourcesPath(): string {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, '..', '..', 'resources');
}

function sendProgress(
  onProgress: (p: InstallProgress) => void,
  partial: Partial<InstallProgress>,
) {
  onProgress({
    componentId: 'prism-vscode',
    status: 'pending',
    percent: 0,
    message: '',
    ...partial,
  } as InstallProgress);
}

/** Resolve the editor CLI command, with macOS fallback */
function getEditorCli(editor: EditorVariant): string {
  const cliName = { vscode: 'code', cursor: 'cursor', windsurf: 'windsurf' }[editor];

  // Try PATH first
  try {
    execSync(`${cliName} --version`, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
    return cliName;
  } catch {
    // Ignore
  }

  // macOS fallback: check Applications folder
  if (process.platform === 'darwin') {
    const fullPath = MACOS_EDITOR_PATHS[editor];
    if (fullPath && fs.existsSync(fullPath)) return fullPath;
  }

  throw new Error(`${editor} CLI not found. Install ${editor} first.`);
}

export async function installVscodeExtension(options: {
  editor: EditorVariant;
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  const { editor, onProgress } = options;

  // 1. Resolve editor CLI
  sendProgress(onProgress, { status: 'installing', percent: 10, message: `Detecting ${editor} CLI...` });
  let cli: string;
  try {
    cli = getEditorCli(editor);
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: `${editor} not found`,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 2. Locate bundled VSIX
  sendProgress(onProgress, { status: 'installing', percent: 30, message: 'Locating extension package...' });
  const vsixPath = path.join(getResourcesPath(), 'extensions', 'prism.vsix');
  if (!fs.existsSync(vsixPath)) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'VSIX not found',
      error: `Extension package missing at ${vsixPath}. Run scripts/prepare-resources.sh first.`,
    });
    return;
  }

  // 3. Install
  sendProgress(onProgress, { status: 'installing', percent: 50, message: `Installing extension via ${editor}...` });
  try {
    execSync(`"${cli}" --install-extension "${vsixPath}"`, {
      timeout: 60000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Installation failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 4. Verify
  sendProgress(onProgress, { status: 'verifying', percent: 80, message: 'Verifying installation...' });
  try {
    const output = execSync(`"${cli}" --list-extensions`, {
      timeout: 15000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (!output.toLowerCase().includes('prism')) {
      sendProgress(onProgress, {
        status: 'error',
        percent: 0,
        message: 'Verification failed',
        error: 'Extension not found in installed extensions list',
      });
      return;
    }
  } catch {
    // Verification is best-effort — don't fail the install
  }

  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'VSCode extension installed' });
}

export async function uninstallVscodeExtension(
  editor: EditorVariant,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  sendProgress(onProgress, { status: 'installing', percent: 30, message: `Removing extension from ${editor}...` });
  try {
    const cli = getEditorCli(editor);
    execSync(`"${cli}" --uninstall-extension prism.prism`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Uninstall failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'VSCode extension removed' });
}
