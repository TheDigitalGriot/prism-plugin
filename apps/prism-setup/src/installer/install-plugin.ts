import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';
import type { InstallProgress } from '../types';
import { getClaudeDir } from './paths';

function getResourcesPath(): string {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, '..', '..', 'resources');
}

function sendProgress(
  onProgress: (p: InstallProgress) => void,
  partial: Partial<InstallProgress>,
) {
  onProgress({
    componentId: 'claude-plugin',
    status: 'pending',
    percent: 0,
    message: '',
    ...partial,
  } as InstallProgress);
}

/** Recursively copy a directory */
function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Try to detect the Claude CLI path */
function detectClaudePath(): string | null {
  try {
    execSync('claude --version', { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
    return 'claude';
  } catch {
    return null;
  }
}

export async function installClaudePlugin(options: {
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  const { onProgress } = options;
  const claudePath = detectClaudePath();

  if (claudePath) {
    // Primary: use Claude CLI for proper installation
    try {
      sendProgress(onProgress, { status: 'installing', percent: 30, message: 'Adding marketplace source...' });
      execSync(`"${claudePath}" plugin marketplace add TheDigitalGriot/prism-plugin`, {
        timeout: 30000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      sendProgress(onProgress, { status: 'installing', percent: 60, message: 'Installing plugin...' });
      execSync(`"${claudePath}" plugin install prism@prism-marketplace`, {
        timeout: 60000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      sendProgress(onProgress, { status: 'verifying', percent: 90, message: 'Verifying installation...' });
      const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'prism-marketplace', 'prism');
      if (fs.existsSync(cacheDir)) {
        sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Plugin installed via Claude CLI' });
        return;
      }
      // Cache dir not found — fall through to file copy
    } catch (err) {
      console.warn('Claude CLI install failed, falling back to file copy:', err);
    }
  }

  // Fallback: direct file copy
  sendProgress(onProgress, { status: 'installing', percent: 40, message: 'Copying plugin files (Claude CLI not available)...' });
  const pluginSrc = path.join(getResourcesPath(), 'plugin');

  if (!fs.existsSync(pluginSrc)) {
    sendProgress(onProgress, {
      status: 'error',
      percent: 0,
      message: 'Plugin files not found',
      error: `Resource missing at ${pluginSrc}. Run scripts/prepare-resources.sh first.`,
    });
    return;
  }

  const claudeDir = getClaudeDir();

  // Copy commands
  const commandsSrc = path.join(pluginSrc, 'commands');
  if (fs.existsSync(commandsSrc)) {
    sendProgress(onProgress, { status: 'installing', percent: 60, message: 'Copying commands...' });
    copyDir(commandsSrc, path.join(claudeDir, 'commands'));
  }

  // Copy agents
  const agentsSrc = path.join(pluginSrc, 'agents');
  if (fs.existsSync(agentsSrc)) {
    sendProgress(onProgress, { status: 'installing', percent: 75, message: 'Copying agents...' });
    copyDir(agentsSrc, path.join(claudeDir, 'agents'));
  }

  sendProgress(onProgress, {
    status: 'complete',
    percent: 100,
    message: 'Plugin files copied. For full /prism: commands, install Claude Code CLI and re-run setup.',
  });
}

export async function uninstallClaudePlugin(
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  const claudePath = detectClaudePath();

  if (claudePath) {
    sendProgress(onProgress, { status: 'installing', percent: 30, message: 'Removing plugin via Claude CLI...' });
    try {
      execSync(`"${claudePath}" plugin uninstall prism@prism-marketplace`, {
        timeout: 30000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Plugin removed via Claude CLI' });
      return;
    } catch {
      // Fall through to manual removal
    }
  }

  // Manual cleanup: remove known prism command/agent files
  sendProgress(onProgress, { status: 'installing', percent: 50, message: 'Cleaning up plugin files...' });
  const claudeDir = getClaudeDir();
  const dirsToClean = ['commands', 'agents'];

  for (const dir of dirsToClean) {
    const fullDir = path.join(claudeDir, dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const file of fs.readdirSync(fullDir)) {
      // Only remove prism-prefixed files to avoid removing other plugins' files
      if (file.startsWith('prism') || file.startsWith('create_plan') || file.startsWith('decompose_plan')) {
        const filePath = path.join(fullDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }
  }

  sendProgress(onProgress, { status: 'complete', percent: 100, message: 'Plugin files removed' });
}
