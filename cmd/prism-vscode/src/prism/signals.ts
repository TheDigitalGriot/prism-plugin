/**
 * Signal protocol parser — port of cmd/prism-cli/domain/signals.go
 *
 * Parses Spectrum signal tags from Claude output text.
 * Priority order: Complete > Error > Retry > Blocked > Continue
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalType = "none" | "complete" | "continue" | "retry" | "blocked" | "error"

export interface Signal {
  type: SignalType
  content: string
  reason: string
}

export interface StoryAnnouncement {
  id: string
  title: string
  priority: string
  files: string[]
}

// ---------------------------------------------------------------------------
// Regex patterns — same patterns as domain/signals.go
// ---------------------------------------------------------------------------

const completeRe = /<promise>COMPLETE<\/promise>/
const continueRe = /<spectrum-continue>([\s\S]*?)<\/spectrum-continue>/
const retryRe = /<spectrum-retry[^>]*>([\s\S]*?)<\/spectrum-retry>/
const blockedRe = /<spectrum-blocked[^>]*>([\s\S]*?)<\/spectrum-blocked>/
const errorRe = /<spectrum-error[^>]*>([\s\S]*?)<\/spectrum-error>/
const storyRe = /<spectrum-story>([\s\S]*?)<\/spectrum-story>/
const reasonRe = /reason="([^"]*)"/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the reason="..." attribute from a matched tag string. */
function extractReasonFromMatch(fullMatch: string): string {
  const m = reasonRe.exec(fullMatch)
  return m ? m[1] : ""
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect and extract the first signal found in output text.
 * Priority: Complete > Error > Retry > Blocked > Continue
 * Mirrors ParseSignal(output string) Signal in Go.
 */
export function parseSignal(output: string): Signal {
  // Highest priority: completion
  if (completeRe.test(output)) {
    return { type: "complete", content: "", reason: "" }
  }

  // Second: error (fatal)
  let match = errorRe.exec(output)
  if (match) {
    return {
      type: "error",
      content: match[1].trim(),
      reason: extractReasonFromMatch(match[0]),
    }
  }

  // Third: retry
  match = retryRe.exec(output)
  if (match) {
    return {
      type: "retry",
      content: match[1].trim(),
      reason: extractReasonFromMatch(match[0]),
    }
  }

  // Fourth: blocked
  match = blockedRe.exec(output)
  if (match) {
    return {
      type: "blocked",
      content: match[1].trim(),
      reason: extractReasonFromMatch(match[0]),
    }
  }

  // Fifth: continue
  match = continueRe.exec(output)
  if (match) {
    return {
      type: "continue",
      content: match[1].trim(),
      reason: "",
    }
  }

  return { type: "none", content: "", reason: "" }
}

/** Returns true if the output contains any Spectrum signal. */
export function containsSignal(output: string): boolean {
  return parseSignal(output).type !== "none"
}

/**
 * Extract a story ID (e.g. "STORY-001") from signal content.
 * Mirrors ExtractStoryID in Go.
 */
export function extractStoryID(content: string): string {
  const storyIDRe = /(STORY-\d+)/
  const match = storyIDRe.exec(content)
  return match ? match[1] : ""
}

/**
 * Parse a <spectrum-story> tag from Claude output.
 * Returns null if no valid announcement found.
 * Mirrors ParseStoryAnnouncement in Go.
 */
export function parseStoryAnnouncement(output: string): StoryAnnouncement | null {
  const match = storyRe.exec(output)
  if (!match) {
    return null
  }

  const content = match[1]
  const announcement: StoryAnnouncement = { id: "", title: "", priority: "", files: [] }

  const idMatch = /ID:\s*(\S+)/.exec(content)
  if (idMatch) {
    announcement.id = idMatch[1]
  }

  const titleMatch = /Title:\s*(.+)/.exec(content)
  if (titleMatch) {
    announcement.title = titleMatch[1].trim()
  }

  const priorityMatch = /Priority:\s*(\d+)/.exec(content)
  if (priorityMatch) {
    announcement.priority = priorityMatch[1]
  }

  const filesMatch = /Files:\s*\n((?:\s*-\s*.+\n?)+)/.exec(content)
  if (filesMatch) {
    for (const line of filesMatch[1].split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith("-")) {
        const file = trimmed.replace(/^-\s*/, "")
        if (file) {
          announcement.files.push(file)
        }
      }
    }
  }

  if (!announcement.id) {
    return null
  }

  return announcement
}
