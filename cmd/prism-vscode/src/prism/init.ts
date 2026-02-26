/**
 * .prism/ directory initialization — port of skills/prism/scripts/init_prism.py logic.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

// ---------------------------------------------------------------------------
// Directory structure
// ---------------------------------------------------------------------------

/** All directories to create inside .prism/ */
const PRISM_SUBDIRS = [
  "stories",
  path.join("shared", "research"),
  path.join("shared", "plans"),
  path.join("shared", "validation"),
  path.join("shared", "spectrum"),
  path.join("shared", "handoffs"),
  path.join("shared", "prs"),
  path.join("shared", "ref"),
  path.join("shared", "docs"),
  "local",
]

const PRISM_GITIGNORE_CONTENT = "local/\n"

// ---------------------------------------------------------------------------
// Core init function (no VS Code dependency — testable in isolation)
// ---------------------------------------------------------------------------

/**
 * Initialize the .prism/ directory structure at the given path.
 * Creates all subdirectories and a .gitignore for local/.
 * Safe to call on an existing directory (no-op for existing paths).
 */
export async function initPrismDir(prismDir: string): Promise<void> {
  for (const subdir of PRISM_SUBDIRS) {
    await fs.mkdir(path.join(prismDir, subdir), { recursive: true })
  }

  const gitignorePath = path.join(prismDir, ".gitignore")
  try {
    await fs.access(gitignorePath)
    // Already exists — leave it alone
  } catch {
    await fs.writeFile(gitignorePath, PRISM_GITIGNORE_CONTENT, "utf-8")
  }
}

// ---------------------------------------------------------------------------
// VS Code command handler
// ---------------------------------------------------------------------------

/**
 * Initialize .prism/ in the active workspace root.
 * Shows VS Code notifications on success/failure.
 * Returns the prismDir path, or undefined on failure.
 */
export async function initPrismDirInWorkspace(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open. Open a folder first.")
    return undefined
  }

  const rootPath = workspaceFolders[0].uri.fsPath
  const prismDir = path.join(rootPath, ".prism")

  try {
    await initPrismDir(prismDir)
    vscode.window.showInformationMessage(`Prism: Initialized .prism/ directory`)
    return prismDir
  } catch (err) {
    vscode.window.showErrorMessage(`Prism: Failed to initialize .prism/ — ${err}`)
    return undefined
  }
}
