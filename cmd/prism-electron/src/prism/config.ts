/**
 * .prism/ directory detection and path resolution — Electron version.
 * Uses Node.js fs.stat instead of vscode.workspace.fs.stat.
 */

import * as fs from 'fs/promises'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Types (mirrored from prism-vscode)
// ---------------------------------------------------------------------------

export interface PrismConfig {
  prismDir: string
  storiesDir: string
  sharedDir: string
  researchDir: string
  plansDir: string
  validationDir: string
  spectrumDir: string
  handoffsDir: string
  prsDir: string
  docsDir: string
  localDir: string
}

// ---------------------------------------------------------------------------
// Path construction
// ---------------------------------------------------------------------------

/** Build a PrismConfig from the .prism/ root directory path. */
export function getPrismConfig(prismDir: string): PrismConfig {
  const shared = path.join(prismDir, 'shared')
  return {
    prismDir,
    storiesDir: path.join(prismDir, 'stories'),
    sharedDir: shared,
    researchDir: path.join(shared, 'research'),
    plansDir: path.join(shared, 'plans'),
    validationDir: path.join(shared, 'validation'),
    spectrumDir: path.join(shared, 'spectrum'),
    handoffsDir: path.join(shared, 'handoffs'),
    prsDir: path.join(shared, 'prs'),
    docsDir: path.join(shared, 'docs'),
    localDir: path.join(prismDir, 'local'),
  }
}

// ---------------------------------------------------------------------------
// Detection (Node.js fs.stat — no vscode dependency)
// ---------------------------------------------------------------------------

/**
 * Detect .prism/ directory in the given project directory.
 * Returns the absolute path, or undefined if not found.
 */
export async function detectPrismDir(projectDir: string): Promise<string | undefined> {
  const candidate = path.join(projectDir, '.prism')
  try {
    await fs.stat(candidate)
    return candidate
  } catch {
    return undefined
  }
}

/**
 * Detect stories.json in the standard flat location within a .prism/ dir.
 * Returns the absolute path, or undefined if not found.
 */
export async function detectStoriesPath(prismDir: string): Promise<string | undefined> {
  const candidate = path.join(prismDir, 'stories', 'stories.json')
  try {
    await fs.stat(candidate)
    return candidate
  } catch {
    return undefined
  }
}
