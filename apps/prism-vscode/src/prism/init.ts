/**
 * .prism/ directory initialization — VS Code wrapper.
 * Core logic lives in @prism-core/prism/init.
 */

import * as vscode from "vscode"
import * as path from "path"
import { initPrismDir } from "@prism-core/prism/init"

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
