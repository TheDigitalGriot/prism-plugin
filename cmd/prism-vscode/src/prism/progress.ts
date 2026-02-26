/**
 * progress.md management — port of cmd/prism-cli/domain/progress.go
 *
 * Reads and appends to the Spectrum progress log. Derives the progress.md
 * path from a stories.json path using the .prism/ directory structure:
 *
 *   Legacy:     .prism/stories/stories.json         → .prism/shared/spectrum/progress.md
 *   Epic-based: .prism/stories/<epic>/stories.json  → .prism/shared/spectrum/<epic>/progress.md
 */

import * as path from "path"
import * as fs from "fs/promises"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressEntry {
  timestamp: Date
  storyID: string
  summary: string
  learnings: string[]
  files: string[]
  qualityGatesStatus: string
  qualityGates: Record<string, string>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a new ProgressEntry with sensible defaults. */
export function newProgressEntry(storyID: string, summary: string): ProgressEntry {
  return {
    timestamp: new Date(),
    storyID,
    summary,
    learnings: [],
    files: [],
    qualityGatesStatus: "All passed",
    qualityGates: {},
  }
}

function formatLearnings(learnings: string[]): string {
  if (learnings.length === 0) {
    return "- No new patterns discovered"
  }
  return learnings.map((l) => `- ${l}`).join("\n")
}

function formatFiles(files: string[]): string {
  if (files.length === 0) {
    return "- None"
  }
  return files.map((f) => `- ${f}`).join("\n")
}

function formatQualityGates(gates: Record<string, string>): string {
  const entries = Object.entries(gates)
  if (entries.length === 0) {
    return ""
  }
  return entries.map(([name, status]) => `- ${name}: ${status}`).join("\n")
}

// ---------------------------------------------------------------------------
// Path derivation
// ---------------------------------------------------------------------------

/**
 * Derives the progress.md path from a stories.json path.
 * Mirrors NewProgressFile(storiesPath string) in Go.
 */
export function progressPathFromStories(storiesPath: string): string {
  const dir = path.dirname(storiesPath) // .prism/stories/  or  .prism/stories/<epic>/
  const dirName = path.basename(dir) // "stories"  or  "<epic-name>"
  const parentDir = path.dirname(dir) // .prism/  or  .prism/stories/
  const parentName = path.basename(parentDir) // ".prism"  or  "stories"

  if (parentName === "stories") {
    // Epic-scoped: .prism/stories/<epic>/stories.json
    const prismDir = path.dirname(parentDir)
    const epicName = dirName
    return path.join(prismDir, "shared", "spectrum", epicName, "progress.md")
  }

  // Legacy flat: .prism/stories/stories.json
  const prismDir = parentDir
  return path.join(prismDir, "shared", "spectrum", "progress.md")
}

// ---------------------------------------------------------------------------
// ProgressFile class
// ---------------------------------------------------------------------------

/**
 * Handles reading and appending to a progress.md file.
 * Mirrors the ProgressFile struct in Go.
 */
export class ProgressFile {
  constructor(public readonly filePath: string) {}

  /** Factory: derive progress path from a stories.json path. */
  static fromStoriesPath(storiesPath: string): ProgressFile {
    return new ProgressFile(progressPathFromStories(storiesPath))
  }

  /** Returns true if the progress file exists on disk. */
  async exists(): Promise<boolean> {
    try {
      await fs.stat(this.filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a new progress file with YAML frontmatter.
   * Creates parent directories as needed.
   */
  async initialize(planName: string): Promise<void> {
    const now = new Date().toISOString()
    const content = `---
plan: ${planName}
startedAt: ${now}
lastUpdated: ${now}
---

# Spectrum Progress Log

## Codebase Patterns (Consolidated)

*Patterns will be added as iterations discover them*

---

`
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, content, "utf-8")
  }

  /** Append a completed-story entry to the progress file. */
  async appendEntry(entry: ProgressEntry): Promise<void> {
    const content = `
---

## ${entry.timestamp.toISOString()} - ${entry.storyID} Complete

**What was done**: ${entry.summary}

**Learnings**:
${formatLearnings(entry.learnings)}

**Files changed**:
${formatFiles(entry.files)}

**Quality gates**: ${entry.qualityGatesStatus}
${formatQualityGates(entry.qualityGates)}
`
    await fs.appendFile(this.filePath, content, "utf-8")
  }

  /**
   * Extract consolidated patterns from the "## Codebase Patterns" section.
   * Returns an empty array if the file doesn't exist or no patterns are found.
   */
  async readPatterns(): Promise<string[]> {
    if (!(await this.exists())) {
      return []
    }

    const data = await fs.readFile(this.filePath, "utf-8")
    const startMarker = "## Codebase Patterns (Consolidated)"
    const endMarker = "---"

    const startIdx = data.indexOf(startMarker)
    if (startIdx === -1) {
      return []
    }

    const afterStart = data.slice(startIdx + startMarker.length)
    let endIdx = afterStart.indexOf(endMarker)
    if (endIdx === -1) {
      endIdx = afterStart.length
    }

    const section = afterStart.slice(0, endIdx).trim()
    const patterns: string[] = []

    for (const line of section.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith("-")) {
        const pattern = trimmed.replace(/^-\s*/, "")
        if (pattern && !pattern.includes("Patterns will be added")) {
          patterns.push(pattern)
        }
      }
    }

    return patterns
  }
}
