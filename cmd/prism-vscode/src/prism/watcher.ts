/**
 * FileSystemWatcher for .prism/ directory changes.
 * Emits typed events when stories.json, research docs, plans,
 * validation reports, or spectrum progress change.
 */

import * as vscode from "vscode"
import * as path from "path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrismFileChangeType =
  | "stories"
  | "research"
  | "plans"
  | "validation"
  | "spectrum"
  | "other"

export interface PrismFileChangeEvent {
  type: PrismFileChangeType
  uri: vscode.Uri
}

// ---------------------------------------------------------------------------
// PrismWatcher
// ---------------------------------------------------------------------------

/**
 * Manages a set of VS Code FileSystemWatchers for the .prism/ directory.
 * Call start(prismDir) to begin watching, dispose() to stop.
 */
export class PrismWatcher implements vscode.Disposable {
  private _watchers: vscode.FileSystemWatcher[] = []
  private _emitter = new vscode.EventEmitter<PrismFileChangeEvent>()

  /** Fires whenever a watched file is created, changed, or deleted. */
  readonly onDidChange: vscode.Event<PrismFileChangeEvent> = this._emitter.event

  /**
   * Start watching the given .prism/ directory.
   * Calling start() again replaces any existing watchers.
   */
  start(prismDir: string): void {
    this.dispose()

    const watchDefs: { glob: vscode.RelativePattern; type: PrismFileChangeType }[] = [
      {
        glob: new vscode.RelativePattern(
          path.join(prismDir, "stories"),
          "**/*.json",
        ),
        type: "stories",
      },
      {
        glob: new vscode.RelativePattern(
          path.join(prismDir, "shared", "research"),
          "**/*.md",
        ),
        type: "research",
      },
      {
        glob: new vscode.RelativePattern(
          path.join(prismDir, "shared", "plans"),
          "**/*.md",
        ),
        type: "plans",
      },
      {
        glob: new vscode.RelativePattern(
          path.join(prismDir, "shared", "validation"),
          "**/*.md",
        ),
        type: "validation",
      },
      {
        glob: new vscode.RelativePattern(
          path.join(prismDir, "shared", "spectrum"),
          "**/*.md",
        ),
        type: "spectrum",
      },
    ]

    for (const { glob, type } of watchDefs) {
      const watcher = vscode.workspace.createFileSystemWatcher(glob)
      const handler = (uri: vscode.Uri): void => {
        this._emitter.fire({ type, uri })
      }
      watcher.onDidChange(handler)
      watcher.onDidCreate(handler)
      watcher.onDidDelete(handler)
      this._watchers.push(watcher)
    }
  }

  dispose(): void {
    for (const w of this._watchers) {
      w.dispose()
    }
    this._watchers = []
  }
}
