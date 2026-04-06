import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PRISM_PATH_MARKER = '.prism/bin';

/** Add installDir to the system PATH (idempotent). */
export async function configurePath(installDir: string): Promise<void> {
  if (process.platform === 'win32') {
    await configurePathWindows(installDir);
  } else {
    await configurePathUnix(installDir);
  }
}

/** Remove installDir from the system PATH. */
export async function removeFromPath(installDir: string): Promise<void> {
  if (process.platform === 'win32') {
    await removePathWindows(installDir);
  } else {
    await removePathUnix(installDir);
  }
}

// --- Unix ---

async function configurePathUnix(installDir: string): Promise<void> {
  const home = os.homedir();
  const rcFiles = [
    path.join(home, '.zshrc'),
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
  ];

  let targetRc = rcFiles.find(f => fs.existsSync(f));
  if (!targetRc) {
    targetRc = path.join(home, '.bashrc');
    fs.writeFileSync(targetRc, '', 'utf-8');
  }

  const content = fs.readFileSync(targetRc, 'utf-8');
  if (!content.includes(PRISM_PATH_MARKER)) {
    fs.appendFileSync(targetRc, `\n# Prism CLI\nexport PATH="$PATH:${installDir}"\n`);
  }
}

async function removePathUnix(installDir: string): Promise<void> {
  const home = os.homedir();
  const rcFiles = [
    path.join(home, '.zshrc'),
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
  ];

  for (const rcFile of rcFiles) {
    if (!fs.existsSync(rcFile)) continue;
    const content = fs.readFileSync(rcFile, 'utf-8');
    if (content.includes(PRISM_PATH_MARKER)) {
      // Remove the Prism CLI PATH block
      const cleaned = content
        .replace(/\n# Prism CLI\nexport PATH="\$PATH:[^"]*\.prism\/bin[^"]*"\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n'); // collapse excess blank lines
      fs.writeFileSync(rcFile, cleaned, 'utf-8');
    }
  }
}

// --- Windows ---

async function configurePathWindows(installDir: string): Promise<void> {
  const currentPath = readWindowsUserPath();
  const normalizedDir = installDir.replace(/\//g, '\\');

  if (!currentPath.toLowerCase().includes(normalizedDir.toLowerCase())) {
    const newPath = currentPath ? `${currentPath};${normalizedDir}` : normalizedDir;
    execSync(
      `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    broadcastSettingChange();
  }
}

async function removePathWindows(installDir: string): Promise<void> {
  const currentPath = readWindowsUserPath();
  const normalizedDir = installDir.replace(/\//g, '\\');

  const parts = currentPath.split(';').filter(
    p => p.toLowerCase() !== normalizedDir.toLowerCase()
  );
  const newPath = parts.join(';');

  if (newPath !== currentPath) {
    execSync(
      `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    broadcastSettingChange();
  }
}

function readWindowsUserPath(): string {
  try {
    const result = execSync(
      'reg query "HKCU\\Environment" /v Path',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const match = result.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/);
    return match?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

function broadcastSettingChange(): void {
  // On Windows, notify other processes that environment has changed.
  // This is a best-effort operation — NSIS installer.nsh handles it more robustly.
  try {
    execSync(
      'powershell -Command "[System.Environment]::SetEnvironmentVariable(\'__dummy\',\'\',[System.EnvironmentVariableTarget]::User)"',
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 },
    );
  } catch {
    // Non-critical — new terminals will pick up the change anyway
  }
}
