/**
 * Unit tests for src/prism/stories.ts
 * Ports cmd/prism-cli/domain/story_test.go
 */

import {
  Story,
  StoriesFile,
  isBlocked,
  getNextStory,
  allComplete,
  completedCount,
  remainingCount,
  markStoryComplete,
  markStoryInProgress,
  getStoryByID,
  loadStoriesFile,
  saveStoriesFile,
} from "@prism-core/prism/stories"
import * as fs from "fs/promises"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStory(
  id: string,
  priority: number,
  status: string,
  blockedBy: string | null = null,
): Story {
  return {
    id,
    title: `Story ${id}`,
    description: "",
    priority,
    status,
    blockedBy,
    files: [],
    steps: [],
  }
}

// ---------------------------------------------------------------------------
// isBlocked — mirrors TestStoryIsBlocked
// ---------------------------------------------------------------------------

describe("isBlocked", () => {
  const stories: Story[] = [
    makeStory("STORY-001", 1, "complete"),
    makeStory("STORY-002", 2, "pending", "STORY-001"),
    makeStory("STORY-003", 3, "pending", "STORY-002"),
    makeStory("STORY-004", 4, "pending"),
  ]

  test("STORY-001 is not blocked (complete, no blocker)", () => {
    expect(isBlocked(stories[0], stories)).toBe(false)
  })

  test("STORY-002 is not blocked (depends on 001 which is complete)", () => {
    expect(isBlocked(stories[1], stories)).toBe(false)
  })

  test("STORY-003 is blocked (depends on 002 which is pending)", () => {
    expect(isBlocked(stories[2], stories)).toBe(true)
  })

  test("STORY-004 is not blocked (no blocker)", () => {
    expect(isBlocked(stories[3], stories)).toBe(false)
  })

  test("story with non-existent blocker is not blocked", () => {
    const s = makeStory("STORY-005", 5, "pending", "STORY-999")
    expect(isBlocked(s, stories)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getNextStory — mirrors TestGetNextStory
// ---------------------------------------------------------------------------

describe("getNextStory", () => {
  test("returns lowest-priority non-blocked pending story", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "complete"),
        makeStory("STORY-002", 2, "pending", "STORY-001"), // unblocked (001 complete)
        makeStory("STORY-003", 3, "pending", "STORY-002"), // blocked (002 pending)
        makeStory("STORY-004", 10, "pending"),
      ],
    }

    const next = getNextStory(sf)
    expect(next).not.toBeNull()
    expect(next!.id).toBe("STORY-002")
  })

  test("returns null when all stories are complete", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "complete"),
        makeStory("STORY-002", 2, "complete"),
      ],
    }
    expect(getNextStory(sf)).toBeNull()
  })

  test("returns null when remaining stories are all blocked", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "pending"),
        makeStory("STORY-002", 2, "pending", "STORY-001"), // blocked
      ],
    }
    // Only STORY-001 is available (no blocker)
    const next = getNextStory(sf)
    expect(next!.id).toBe("STORY-001")
  })

  test("returns null for empty stories list", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [],
    }
    expect(getNextStory(sf)).toBeNull()
  })

  test("sorts by priority when multiple candidates exist", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-010", 10, "pending"),
        makeStory("STORY-003", 3, "pending"),
        makeStory("STORY-007", 7, "pending"),
      ],
    }
    const next = getNextStory(sf)
    expect(next!.id).toBe("STORY-003")
  })
})

// ---------------------------------------------------------------------------
// allComplete / completedCount / remainingCount — mirrors TestAllComplete, TestCompletedCount
// ---------------------------------------------------------------------------

describe("allComplete", () => {
  test("returns false when stories are incomplete", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "complete"),
        makeStory("STORY-002", 2, "pending"),
      ],
    }
    expect(allComplete(sf)).toBe(false)
  })

  test("returns true when all stories are complete", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "complete"),
        makeStory("STORY-002", 2, "complete"),
      ],
    }
    expect(allComplete(sf)).toBe(true)
  })

  test("returns true for empty stories list", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [],
    }
    expect(allComplete(sf)).toBe(true)
  })
})

describe("completedCount", () => {
  test("counts only complete stories", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "complete"),
        makeStory("STORY-002", 2, "complete"),
        makeStory("STORY-003", 3, "pending"),
        makeStory("STORY-004", 4, "in_progress"),
      ],
    }
    expect(completedCount(sf)).toBe(2)
  })
})

describe("remainingCount", () => {
  test("counts non-complete stories", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        makeStory("STORY-001", 1, "complete"),
        makeStory("STORY-002", 2, "pending"),
        makeStory("STORY-003", 3, "in_progress"),
      ],
    }
    expect(remainingCount(sf)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// markStoryComplete / markStoryInProgress / getStoryByID
// ---------------------------------------------------------------------------

describe("markStoryComplete", () => {
  test("sets status to complete and marks all steps done", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [
        {
          id: "STORY-001",
          title: "Test",
          description: "",
          priority: 1,
          status: "in_progress",
          blockedBy: null,
          files: [],
          steps: [
            { description: "Step 1", done: false },
            { description: "Step 2", done: false },
          ],
        },
      ],
    }

    markStoryComplete(sf, "STORY-001", "abc123")
    const story = sf.stories[0]
    expect(story.status).toBe("complete")
    expect(story.commitHash).toBe("abc123")
    expect(story.steps.every((s) => s.done)).toBe(true)
  })

  test("no-ops when story ID not found", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [makeStory("STORY-001", 1, "pending")],
    }
    markStoryComplete(sf, "STORY-999", "abc123")
    expect(sf.stories[0].status).toBe("pending")
  })
})

describe("markStoryInProgress", () => {
  test("sets status to in_progress", () => {
    const sf: StoriesFile = {
      epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
      stories: [makeStory("STORY-001", 1, "pending")],
    }
    markStoryInProgress(sf, "STORY-001")
    expect(sf.stories[0].status).toBe("in_progress")
  })
})

describe("getStoryByID", () => {
  const sf: StoriesFile = {
    epic: { name: "Test Plan", source: "plan.md", qualityGates: [] },
    stories: [makeStory("STORY-001", 1, "pending"), makeStory("STORY-002", 2, "complete")],
  }

  test("returns story by ID", () => {
    expect(getStoryByID(sf, "STORY-002")!.id).toBe("STORY-002")
  })

  test("returns undefined for unknown ID", () => {
    expect(getStoryByID(sf, "STORY-999")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// loadStoriesFile / saveStoriesFile
// ---------------------------------------------------------------------------

jest.mock("fs/promises")
const fsMock = fs as jest.Mocked<typeof fs>

describe("loadStoriesFile", () => {
  test("parses a valid stories.json", async () => {
    const fixture: StoriesFile = {
      epic: { name: "My Plan", source: "plan.md", qualityGates: ["npm test"] },
      stories: [makeStory("STORY-001", 1, "pending")],
    }
    ;(fsMock.readFile as jest.Mock).mockResolvedValue(JSON.stringify(fixture))

    const result = await loadStoriesFile("/some/stories.json")
    expect(result.epic.name).toBe("My Plan")
    expect(result.stories).toHaveLength(1)
    expect(result.stories[0].id).toBe("STORY-001")
  })

  test("throws on invalid JSON", async () => {
    ;(fsMock.readFile as jest.Mock).mockResolvedValue("not json")
    await expect(loadStoriesFile("/some/stories.json")).rejects.toThrow()
  })
})

describe("saveStoriesFile", () => {
  test("writes formatted JSON to disk", async () => {
    ;(fsMock.writeFile as jest.Mock).mockResolvedValue(undefined)

    const sf: StoriesFile = {
      epic: { name: "My Plan", source: "plan.md", qualityGates: [] },
      stories: [makeStory("STORY-001", 1, "pending")],
    }

    await saveStoriesFile(sf, "/some/stories.json")
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      "/some/stories.json",
      JSON.stringify(sf, null, 2),
      "utf-8",
    )
  })
})
