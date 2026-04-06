/**
 * Unit tests for src/prism/progress.ts
 * Ports cmd/prism-cli/domain/progress_test.go
 */

import * as path from "path"
import { progressPathFromStories } from "@prism-core/prism/progress"

// ---------------------------------------------------------------------------
// progressPathFromStories — mirrors TestNewProgressFile_* in Go
// ---------------------------------------------------------------------------

describe("progressPathFromStories", () => {
  test("legacy flat: .prism/stories/stories.json → .prism/shared/spectrum/progress.md", () => {
    const storiesPath = path.join("project", ".prism", "stories", "stories.json")
    const result = progressPathFromStories(storiesPath)
    const expected = path.join("project", ".prism", "shared", "spectrum", "progress.md")
    expect(result).toBe(expected)
  })

  test("epic-scoped: .prism/stories/<epic>/stories.json → .prism/shared/spectrum/<epic>/progress.md", () => {
    const storiesPath = path.join("project", ".prism", "stories", "user-auth", "stories.json")
    const result = progressPathFromStories(storiesPath)
    const expected = path.join(
      "project",
      ".prism",
      "shared",
      "spectrum",
      "user-auth",
      "progress.md",
    )
    expect(result).toBe(expected)
  })

  test("epic with dashes in name", () => {
    const storiesPath = path.join(
      "project",
      ".prism",
      "stories",
      "multi-view-dashboard",
      "stories.json",
    )
    const result = progressPathFromStories(storiesPath)
    const expected = path.join(
      "project",
      ".prism",
      "shared",
      "spectrum",
      "multi-view-dashboard",
      "progress.md",
    )
    expect(result).toBe(expected)
  })

  test("absolute path legacy", () => {
    const storiesPath = path.join(
      path.sep,
      "home",
      "user",
      "project",
      ".prism",
      "stories",
      "stories.json",
    )
    const result = progressPathFromStories(storiesPath)
    const expected = path.join(
      path.sep,
      "home",
      "user",
      "project",
      ".prism",
      "shared",
      "spectrum",
      "progress.md",
    )
    expect(result).toBe(expected)
  })

  test("absolute path epic-scoped", () => {
    const storiesPath = path.join(
      path.sep,
      "home",
      "user",
      "project",
      ".prism",
      "stories",
      "my-epic",
      "stories.json",
    )
    const result = progressPathFromStories(storiesPath)
    const expected = path.join(
      path.sep,
      "home",
      "user",
      "project",
      ".prism",
      "shared",
      "spectrum",
      "my-epic",
      "progress.md",
    )
    expect(result).toBe(expected)
  })
})
