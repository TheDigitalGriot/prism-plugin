/**
 * .prism/ directory detection — VS Code wrapper.
 * Core path logic lives in @prism-core/prism/config.
 */

import * as vscode from "vscode"
import {
  detectPrismDir as detectPrismDirShared,
  detectStoriesPath as detectStoriesPathShared,
  getPrismConfig,
} from "@prism-core/prism/config"

export type { PrismConfig } from "@prism-core/prism/config"
export { getPrismConfig }

// ---------------------------------------------------------------------------
// Detection (VS Code workspace API wrappers)
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
  return detectPrismDirShared(workspaceFolders[0].uri.fsPath)
}

/**
 * Detect stories.json in the standard flat location within a .prism/ dir.
 * Returns the fsPath, or undefined if not found.
 */
export async function detectStoriesPath(prismDir: string): Promise<string | undefined> {
  return detectStoriesPathShared(prismDir)
}
