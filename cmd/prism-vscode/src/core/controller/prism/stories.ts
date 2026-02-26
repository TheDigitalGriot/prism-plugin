/**
 * Stories state manager — loads and caches stories.json for the controller.
 *
 * This sits between the domain model (src/prism/stories.ts) and the
 * extension state, keeping the in-memory StoriesFile in sync with disk.
 */

import {
  StoriesFile,
  loadStoriesFile,
  saveStoriesFile,
  getNextStory,
  markStoryComplete,
  markStoryInProgress,
  completedCount,
  remainingCount,
  allComplete,
} from "../../../prism/stories"

export class StoriesManager {
  private _storiesFile: StoriesFile | undefined
  private _storiesPath: string | undefined

  get storiesFile(): StoriesFile | undefined {
    return this._storiesFile
  }

  get storiesPath(): string | undefined {
    return this._storiesPath
  }

  /** Load (or reload) stories from the given path. */
  async load(storiesPath: string): Promise<StoriesFile> {
    const sf = await loadStoriesFile(storiesPath)
    this._storiesFile = sf
    this._storiesPath = storiesPath
    return sf
  }

  /** Persist the current in-memory state back to disk. */
  async save(): Promise<void> {
    if (!this._storiesFile || !this._storiesPath) {
      throw new Error("StoriesManager: no stories file loaded")
    }
    await saveStoriesFile(this._storiesFile, this._storiesPath)
  }

  /** Returns the next story to execute, or null if all done / blocked. */
  getNextStory() {
    if (!this._storiesFile) return null
    return getNextStory(this._storiesFile)
  }

  /** Mark a story complete and persist. */
  async markComplete(storyID: string, commitHash: string): Promise<void> {
    if (!this._storiesFile) throw new Error("StoriesManager: no stories loaded")
    markStoryComplete(this._storiesFile, storyID, commitHash)
    await this.save()
  }

  /** Mark a story in-progress and persist. */
  async markInProgress(storyID: string): Promise<void> {
    if (!this._storiesFile) throw new Error("StoriesManager: no stories loaded")
    markStoryInProgress(this._storiesFile, storyID)
    await this.save()
  }

  completedCount(): number {
    if (!this._storiesFile) return 0
    return completedCount(this._storiesFile)
  }

  remainingCount(): number {
    if (!this._storiesFile) return 0
    return remainingCount(this._storiesFile)
  }

  allComplete(): boolean {
    if (!this._storiesFile) return false
    return allComplete(this._storiesFile)
  }

  /** Clears in-memory state (e.g. when .prism/ is removed). */
  clear(): void {
    this._storiesFile = undefined
    this._storiesPath = undefined
  }
}
