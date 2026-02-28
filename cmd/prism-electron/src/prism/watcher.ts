/**
 * File watcher for .prism/ directory changes — Electron version.
 * Uses chokidar instead of vscode.FileSystemWatcher.
 * Emits typed events when stories.json, research docs, plans,
 * validation reports, or spectrum progress change.
 */

import chokidar, { FSWatcher } from 'chokidar'
import { EventEmitter } from 'events'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrismFileChangeType =
  | 'stories'
  | 'research'
  | 'plans'
  | 'validation'
  | 'spectrum'
  | 'other'

export interface PrismFileChangeEvent {
  type: PrismFileChangeType
  filePath: string
}

// ---------------------------------------------------------------------------
// PrismWatcher
// ---------------------------------------------------------------------------

/**
 * Manages a chokidar watcher for the .prism/ directory.
 * Call start(prismDir) to begin watching, dispose() to stop.
 *
 * Emits 'change' events with PrismFileChangeEvent payload.
 */
export class PrismWatcher extends EventEmitter {
  private _watcher: FSWatcher | null = null

  /**
   * Start watching the given .prism/ directory.
   * Calling start() again replaces any existing watcher.
   */
  start(prismDir: string): void {
    this.dispose()
    this._watcher = chokidar.watch(prismDir, {
      ignoreInitial: true,
      persistent: false,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })
    this._watcher.on('all', (_event: string, filePath: string) => {
      const type = this._classify(prismDir, filePath)
      this.emit('change', { type, filePath } as PrismFileChangeEvent)
    })
  }

  private _classify(prismDir: string, filePath: string): PrismFileChangeType {
    const rel = path.relative(prismDir, filePath)
    if (rel.startsWith('stories')) return 'stories'
    if (rel.startsWith(path.join('shared', 'research'))) return 'research'
    if (rel.startsWith(path.join('shared', 'plans'))) return 'plans'
    if (rel.startsWith(path.join('shared', 'validation'))) return 'validation'
    if (rel.startsWith(path.join('shared', 'spectrum'))) return 'spectrum'
    return 'other'
  }

  dispose(): void {
    this._watcher?.close()
    this._watcher = null
  }
}
