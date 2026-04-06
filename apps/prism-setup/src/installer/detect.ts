import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SystemInfo, ComponentStatus } from '../types';
import {
  getPrismCliBinaryPath,
  getClaudePluginCacheDir,
  getElectronAppPath,
  getPrismDir,
  MACOS_EDITOR_PATHS,
} from './paths';

type CliResult = { available: boolean; path: string | null; version: string | null };

/** Run a CLI command and return its stdout, or null on failure */
function tryExec(command: string, timeoutMs = 5000): string | null {
  try {
    return execSync(command, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/** Generic CLI detection: try running `name --version` (or custom flag) */
function detectCli(name: string, versionFlag = '--version'): CliResult {
  const output = tryExec(`${name} ${versionFlag}`);
  if (output) {
    // Extract first line, strip leading 'v' if present
    const firstLine = output.split('\n')[0].trim();
    const version = firstLine.replace(/^v/, '');
    return { available: true, path: name, version };
  }
  return { available: false, path: null, version: null };
}

// --- Specific detectors ---

type EditorResult = { available: boolean; path: string | null; variant: 'vscode' | 'cursor' | 'windsurf' };

function detectEditor(name: 'vscode' | 'cursor' | 'windsurf'): EditorResult {
  const cliName = { vscode: 'code', cursor: 'cursor', windsurf: 'windsurf' }[name];

  // Try PATH first
  const result = detectCli(cliName);
  if (result.available) {
    return { available: true, path: result.path, variant: name };
  }

  // macOS fallback: check Applications folder
  if (process.platform === 'darwin') {
    const appPath = MACOS_EDITOR_PATHS[name];
    if (appPath && fs.existsSync(appPath)) {
      const version = tryExec(`"${appPath}" --version`);
      return { available: true, path: appPath, variant: name };
    }
  }

  return { available: false, path: null, variant: name };
}

function detectVSCode(): EditorResult {
  return detectEditor('vscode');
}

function detectCursor(): EditorResult {
  return detectEditor('cursor');
}

function detectWindsurf(): EditorResult {
  return detectEditor('windsurf');
}

function detectClaude(): CliResult {
  return detectCli('claude');
}

function detectPrismCli(): CliResult {
  const binaryPath = getPrismCliBinaryPath();
  if (fs.existsSync(binaryPath)) {
    const output = tryExec(`"${binaryPath}" --version`);
    const version = output?.replace(/^v/, '') ?? null;
    return { available: true, path: binaryPath, version };
  }
  return { available: false, path: null, version: null };
}

function detectPrismPlugin(): { available: boolean; version: string | null } {
  const cacheDir = getClaudePluginCacheDir();

  // Find the latest version directory in the cache
  if (fs.existsSync(cacheDir)) {
    try {
      const versions = fs.readdirSync(cacheDir).filter(d => {
        return fs.statSync(path.join(cacheDir, d)).isDirectory();
      });
      if (versions.length > 0) {
        // Try to read plugin.json for version
        const latest = versions.sort().pop()!;
        const pluginJsonPath = path.join(cacheDir, latest, '.claude-plugin', 'plugin.json');
        if (fs.existsSync(pluginJsonPath)) {
          const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
          return { available: true, version: pluginJson.version ?? latest };
        }
        return { available: true, version: latest };
      }
    } catch {
      // Fall through
    }
  }
  return { available: false, version: null };
}

function detectPrismElectron(): { available: boolean; version: string | null } {
  const appPath = getElectronAppPath();

  if (process.platform === 'win32') {
    // On Windows, check for Squirrel-installed app
    if (fs.existsSync(appPath)) {
      return { available: true, version: null };
    }
  } else if (process.platform === 'darwin') {
    if (fs.existsSync(appPath)) {
      // Try reading version from Info.plist
      try {
        const plistPath = path.join(appPath, 'Contents', 'Info.plist');
        if (fs.existsSync(plistPath)) {
          const content = fs.readFileSync(plistPath, 'utf-8');
          const match = content.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
          if (match) return { available: true, version: match[1] };
        }
      } catch {
        // Fall through
      }
      return { available: true, version: null };
    }
  } else {
    // Linux: check common paths
    if (fs.existsSync(appPath) || fs.existsSync('/usr/bin/prism-electron')) {
      return { available: true, version: null };
    }
  }

  return { available: false, version: null };
}

function detectNode(): CliResult {
  return detectCli('node', '-v');
}

function detectGo(): CliResult {
  const result = detectCli('go', 'version');
  if (result.available && result.version) {
    // go version output: "go version go1.22.0 ..."
    const match = result.version.match(/go(\d+\.\d+(?:\.\d+)?)/);
    if (match) result.version = match[1];
  }
  return result;
}

// --- Full system scan ---

export async function getSystemInfo(): Promise<SystemInfo> {
  const platform = process.platform as SystemInfo['platform'];
  const arch = process.arch as SystemInfo['arch'];

  const vscode = detectVSCode();
  const cursor = detectCursor();
  const windsurf = detectWindsurf();
  const claude = detectClaude();
  const node = detectNode();
  const go = detectGo();
  const prismCli = detectPrismCli();
  const prismPlugin = detectPrismPlugin();
  const prismElectron = detectPrismElectron();
  const prismDir = getPrismDir();

  const hasEditor = vscode.available || cursor.available || windsurf.available;

  const components: ComponentStatus[] = [
    {
      id: 'prism-cli',
      name: 'Prism CLI',
      description: 'TUI dashboard for managing Prism workspaces',
      installed: prismCli.available,
      currentVersion: prismCli.version,
      latestVersion: null, // filled by version.ts
      updateAvailable: false,
      prerequisiteMet: true,
      prerequisiteMessage: null,
    },
    {
      id: 'prism-vscode',
      name: 'Prism VSCode Extension',
      description: 'AI-powered sidebar and panel for VSCode/Cursor/Windsurf',
      installed: false, // TODO: detect via `code --list-extensions`
      currentVersion: null,
      latestVersion: null,
      updateAvailable: false,
      prerequisiteMet: hasEditor,
      prerequisiteMessage: hasEditor ? null : 'Requires VSCode, Cursor, or Windsurf',
    },
    {
      id: 'prism-electron',
      name: 'Prism Desktop App',
      description: 'Standalone desktop IDE shell',
      installed: prismElectron.available,
      currentVersion: prismElectron.version,
      latestVersion: null,
      updateAvailable: false,
      prerequisiteMet: true,
      prerequisiteMessage: null,
    },
    {
      id: 'claude-plugin',
      name: 'Claude Code Plugin',
      description: 'Structured workflow commands for Claude Code',
      installed: prismPlugin.available,
      currentVersion: prismPlugin.version,
      latestVersion: null,
      updateAvailable: false,
      prerequisiteMet: true,
      prerequisiteMessage: claude.available ? null : 'Claude CLI not found — will use file copy fallback',
    },
  ];

  return {
    platform,
    arch,
    homedir: os.homedir(),
    vscodeAvailable: vscode.available,
    vscodePath: vscode.path,
    cursorAvailable: cursor.available,
    windsurfAvailable: windsurf.available,
    claudeAvailable: claude.available,
    claudePath: claude.path,
    nodeAvailable: node.available,
    goAvailable: go.available,
    existingPrismDir: fs.existsSync(prismDir),
    components,
  };
}
