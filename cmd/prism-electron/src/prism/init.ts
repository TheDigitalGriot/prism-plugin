/**
 * .prism/ directory initialization — Electron version.
 * Mirrors cmd/prism-vscode/src/prism/init.ts (initPrismDir only, no VSCode).
 */

import * as path from 'path'
import * as fs from 'fs/promises'

const PRISM_SUBDIRS = [
  'stories',
  path.join('shared', 'research'),
  path.join('shared', 'plans'),
  path.join('shared', 'validation'),
  path.join('shared', 'spectrum'),
  path.join('shared', 'handoffs'),
  path.join('shared', 'prs'),
  path.join('shared', 'ref'),
  path.join('shared', 'docs'),
  'local',
]

const PRISM_GITIGNORE_CONTENT = 'local/\n'

/**
 * Initialize the .prism/ directory structure at the given path.
 * Creates all subdirectories and a .gitignore for local/.
 * Safe to call on an existing directory (no-op for existing paths).
 */
export async function initPrismDir(prismDir: string): Promise<void> {
  for (const subdir of PRISM_SUBDIRS) {
    await fs.mkdir(path.join(prismDir, subdir), { recursive: true })
  }

  const gitignorePath = path.join(prismDir, '.gitignore')
  try {
    await fs.access(gitignorePath)
    // Already exists — leave it alone
  } catch {
    await fs.writeFile(gitignorePath, PRISM_GITIGNORE_CONTENT, 'utf-8')
  }
}
