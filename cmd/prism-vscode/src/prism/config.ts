/**
 * .prism/ directory detection and path resolution.
 */

import * as vscode from "vscode"
import * as path from "path"

// ---------------------------------------------------------------------------
// Types
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
  const shared = path.join(prismDir, "shared")
  return {
    prismDir,
    storiesDir: path.join(prismDir, "stories"),
    sharedDir: shared,
    researchDir: path.join(shared, "research"),
    plansDir: path.join(shared, "plans"),
    validationDir: path.join(shared, "validation"),
    spectrumDir: path.join(shared, "spectrum"),
    handoffsDir: path.join(shared, "handoffs"),
    prsDir: path.join(shared, "prs"),
    docsDir: path.join(shared, "docs"),
    localDir: path.join(prismDir, "local"),
  }
}

// ---------------------------------------------------------------------------
// Detection (VS Code workspace API)
// ---------------------------------------------------------------------------

/**
 * Detect .prism/ directory in the current VS Code workspace root.
 * Returns the fsPath, or undefined if not found.
 */
export async function detectPrismDir(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined
  }

  const rootUri = workspaceFolders[0].uri
  const prismDirUri = vscode.Uri.joinPath(rootUri, ".prism")

  try {
    await vscode.workspace.fs.stat(prismDirUri)
    return prismDirUri.fsPath
  } catch {
    return undefined
  }
}

/**
 * Detect stories.json in the standard flat location within a .prism/ dir.
 * Returns the fsPath, or undefined if not found.
 */
export async function detectStoriesPath(prismDir: string): Promise<string | undefined> {
  const storiesUri = vscode.Uri.file(path.join(prismDir, "stories", "stories.json"))
  try {
    await vscode.workspace.fs.stat(storiesUri)
    return storiesUri.fsPath
  } catch {
    return undefined
  }
}
