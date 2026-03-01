/**
 * Shared types for BasePrismController and its platform subclasses.
 */

/** Function to post a message to the webview/renderer. */
export type PostMessageFn = (message: unknown) => Promise<void>

/** Data emitted when a Claude session starts. */
export interface AgentSessionData {
  sessionId: string
  storyId?: string
  storyTitle?: string
  isSpectrum?: boolean
}

/** Data emitted when the active Spectrum story changes. */
export interface UpdatedStoryData {
  storyId: string
  storyTitle: string
}
