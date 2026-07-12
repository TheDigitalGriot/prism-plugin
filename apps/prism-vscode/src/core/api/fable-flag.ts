/**
 * Fable on/off flag — single source of truth.
 *
 * Both surfaces (extension host + panel) read the Fable enablement flag from
 * a single file at `<workspaceRoot>/.prism/local/fable.flag`. The file is a
 * JSON object of the shape `{ "enabled": boolean }`. It lives under
 * `.prism/local/` (gitignored), so it is never committed.
 */
import * as fs from "fs"
import * as path from "path"

/**
 * Read the Fable flag for the given workspace.
 *
 * Returns `true` ONLY when the flag file exists and parses as a JSON object
 * whose `enabled` field is strictly `true`. Returns `false` for every other
 * case: missing file, read error, malformed JSON, or `enabled !== true`.
 */
export function isFableEnabled(workspaceRoot: string): boolean {
  try {
    const flagPath = path.join(workspaceRoot, ".prism", "local", "fable.flag")
    const raw = fs.readFileSync(flagPath, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { enabled?: unknown }).enabled === true
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}
