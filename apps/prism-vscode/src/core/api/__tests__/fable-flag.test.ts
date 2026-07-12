/**
 * Unit tests for src/core/api/fable-flag.ts
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { isFableEnabled } from "../fable-flag"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temp workspace root and write `.prism/local/fable.flag` if content given. */
function makeWorkspace(flagContent?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fable-flag-"))
  if (flagContent !== undefined) {
    const localDir = path.join(root, ".prism", "local")
    fs.mkdirSync(localDir, { recursive: true })
    fs.writeFileSync(path.join(localDir, "fable.flag"), flagContent, "utf8")
  }
  return root
}

describe("isFableEnabled", () => {
  const roots: string[] = []

  afterAll(() => {
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test("returns false when the flag file is absent", () => {
    const root = makeWorkspace()
    roots.push(root)
    expect(isFableEnabled(root)).toBe(false)
  })

  test("returns false when the flag path is a directory (read error)", () => {
    const root = makeWorkspace()
    roots.push(root)
    // Create a directory where the flag file is expected → readFileSync throws.
    fs.mkdirSync(path.join(root, ".prism", "local", "fable.flag"), {
      recursive: true,
    })
    expect(isFableEnabled(root)).toBe(false)
  })

  test("returns false on malformed JSON", () => {
    const root = makeWorkspace("{ not valid json ")
    roots.push(root)
    expect(isFableEnabled(root)).toBe(false)
  })

  test('returns false for {"enabled":false}', () => {
    const root = makeWorkspace(JSON.stringify({ enabled: false }))
    roots.push(root)
    expect(isFableEnabled(root)).toBe(false)
  })

  test('returns true for {"enabled":true}', () => {
    const root = makeWorkspace(JSON.stringify({ enabled: true }))
    roots.push(root)
    expect(isFableEnabled(root)).toBe(true)
  })
})
