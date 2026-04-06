/**
 * Unit tests for src/prism/signals.ts
 * Ports cmd/prism-cli/domain/signals_test.go
 */

import {
  parseSignal,
  containsSignal,
  extractStoryID,
  parseStoryAnnouncement,
} from "@prism-core/prism/signals"

// ---------------------------------------------------------------------------
// parseSignal — mirrors TestParseSignal
// ---------------------------------------------------------------------------

describe("parseSignal", () => {
  test("complete signal", () => {
    const signal = parseSignal("Some output\n<promise>COMPLETE</promise>\nMore output")
    expect(signal.type).toBe("complete")
  })

  test("continue signal with content", () => {
    const signal = parseSignal(
      "<spectrum-continue>STORY_COMPLETE: STORY-001</spectrum-continue>",
    )
    expect(signal.type).toBe("continue")
    expect(signal.content).toBe("STORY_COMPLETE: STORY-001")
  })

  test("retry signal with reason attribute", () => {
    const signal = parseSignal(
      `<spectrum-retry reason="QUALITY_GATE_FAILED">npm test failed</spectrum-retry>`,
    )
    expect(signal.type).toBe("retry")
    expect(signal.content).toBe("npm test failed")
    expect(signal.reason).toBe("QUALITY_GATE_FAILED")
  })

  test("blocked signal with reason attribute", () => {
    const signal = parseSignal(
      `<spectrum-blocked reason="UNCLEAR">Need clarification</spectrum-blocked>`,
    )
    expect(signal.type).toBe("blocked")
    expect(signal.content).toBe("Need clarification")
    expect(signal.reason).toBe("UNCLEAR")
  })

  test("error signal with reason attribute", () => {
    const signal = parseSignal(
      `<spectrum-error reason="MERGE_CONFLICT">Cannot merge</spectrum-error>`,
    )
    expect(signal.type).toBe("error")
    expect(signal.content).toBe("Cannot merge")
    expect(signal.reason).toBe("MERGE_CONFLICT")
  })

  test("no signal returns none", () => {
    const signal = parseSignal("Just regular output without any signals")
    expect(signal.type).toBe("none")
    expect(signal.content).toBe("")
    expect(signal.reason).toBe("")
  })

  test("multiline complete signal", () => {
    const signal = parseSignal("Line 1\nLine 2\n<promise>COMPLETE</promise>\nLine 3")
    expect(signal.type).toBe("complete")
  })

  // Priority ordering tests
  test("complete takes priority over error", () => {
    const input =
      "<promise>COMPLETE</promise>\n<spectrum-error>Some error</spectrum-error>"
    expect(parseSignal(input).type).toBe("complete")
  })

  test("error takes priority over retry", () => {
    const input =
      "<spectrum-error>Fatal</spectrum-error>\n<spectrum-retry>Try again</spectrum-retry>"
    expect(parseSignal(input).type).toBe("error")
  })

  test("retry takes priority over blocked", () => {
    const input =
      "<spectrum-retry>Retry</spectrum-retry>\n<spectrum-blocked>Blocked</spectrum-blocked>"
    expect(parseSignal(input).type).toBe("retry")
  })

  test("blocked takes priority over continue", () => {
    const input =
      "<spectrum-blocked>Blocked</spectrum-blocked>\n<spectrum-continue>Continue</spectrum-continue>"
    expect(parseSignal(input).type).toBe("blocked")
  })

  test("multiline content in continue signal", () => {
    const signal = parseSignal(
      "<spectrum-continue>Line one\nLine two\nLine three</spectrum-continue>",
    )
    expect(signal.type).toBe("continue")
    expect(signal.content).toBe("Line one\nLine two\nLine three")
  })

  test("signal without reason attribute has empty reason", () => {
    const signal = parseSignal("<spectrum-retry>Something failed</spectrum-retry>")
    expect(signal.reason).toBe("")
  })
})

// ---------------------------------------------------------------------------
// containsSignal
// ---------------------------------------------------------------------------

describe("containsSignal", () => {
  test("returns true for output with a signal", () => {
    expect(containsSignal("<promise>COMPLETE</promise>")).toBe(true)
    expect(containsSignal("<spectrum-continue>ok</spectrum-continue>")).toBe(true)
  })

  test("returns false for plain output", () => {
    expect(containsSignal("No signal here at all")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// extractStoryID — mirrors TestExtractStoryID
// ---------------------------------------------------------------------------

describe("extractStoryID", () => {
  test("extracts story ID from STORY_COMPLETE prefix", () => {
    expect(extractStoryID("STORY_COMPLETE: STORY-001")).toBe("STORY-001")
  })

  test("extracts story ID from free-form text", () => {
    expect(extractStoryID("Completed STORY-123 successfully")).toBe("STORY-123")
  })

  test("returns empty string when no story ID found", () => {
    expect(extractStoryID("No story here")).toBe("")
  })
})

// ---------------------------------------------------------------------------
// parseStoryAnnouncement — mirrors TestParseStoryAnnouncement
// ---------------------------------------------------------------------------

describe("parseStoryAnnouncement", () => {
  const input = `<spectrum-story>
ID: STORY-003
Title: Add user authentication
Priority: 5
Files:
- src/auth/login.ts
- src/types/auth.ts
</spectrum-story>`

  test("parses ID, title, priority, and files", () => {
    const announcement = parseStoryAnnouncement(input)
    expect(announcement).not.toBeNull()
    expect(announcement!.id).toBe("STORY-003")
    expect(announcement!.title).toBe("Add user authentication")
    expect(announcement!.priority).toBe("5")
    expect(announcement!.files).toHaveLength(2)
    expect(announcement!.files[0]).toBe("src/auth/login.ts")
    expect(announcement!.files[1]).toBe("src/types/auth.ts")
  })

  test("returns null when no spectrum-story tag present", () => {
    expect(parseStoryAnnouncement("no story tag here")).toBeNull()
  })

  test("returns null when ID is missing", () => {
    const noId = "<spectrum-story>\nTitle: Something\nPriority: 1\n</spectrum-story>"
    expect(parseStoryAnnouncement(noId)).toBeNull()
  })

  test("handles story with no files", () => {
    const noFiles = `<spectrum-story>
ID: STORY-001
Title: Simple task
Priority: 1
</spectrum-story>`
    const announcement = parseStoryAnnouncement(noFiles)
    expect(announcement).not.toBeNull()
    expect(announcement!.files).toHaveLength(0)
  })
})
