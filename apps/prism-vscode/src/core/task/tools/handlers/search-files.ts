import { exec } from "child_process"
import * as path from "path"
import { promisify } from "util"
import { IToolHandler, ToolExecutionContext } from "../types"

const execAsync = promisify(exec)

const MAX_RESULTS = 200

export class SearchFilesHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const pattern = input.pattern as string
    if (!pattern) throw new Error("search_files: 'pattern' is required")

    const glob = (input.glob as string) ?? ""
    const caseInsensitive = input.case_insensitive === "true"

    // Use ripgrep if available, fall back to grep
    const flags = [
      caseInsensitive ? "-i" : "",
      "-n", // line numbers
      "--max-count=5", // max 5 matches per file
      `--max-filesize=1M`,
      glob ? `--glob="${glob}"` : "",
    ]
      .filter(Boolean)
      .join(" ")

    const cmd = `rg ${flags} "${pattern.replace(/"/g, '\\"')}" .`

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: ctx.workspaceRoot,
        timeout: 30_000,
        maxBuffer: 1024 * 1024 * 5,
      })

      const lines = stdout.split("\n").filter(Boolean)
      const truncated = lines.length > MAX_RESULTS
      const results = lines.slice(0, MAX_RESULTS).join("\n")

      if (!results) {
        return `No matches found for pattern: ${pattern}`
      }

      return [
        `Search results for: ${pattern}${glob ? ` (glob: ${glob})` : ""}`,
        results,
        truncated ? `\n[Showing first ${MAX_RESULTS} of ${lines.length} matches]` : "",
      ]
        .filter(Boolean)
        .join("\n")
    } catch (err: unknown) {
      const error = err as { code?: number }
      if (error.code === 1) {
        // ripgrep exits with 1 when no matches found
        return `No matches found for pattern: ${pattern}`
      }
      // Try grep as fallback
      return this._grepFallback(pattern, glob, caseInsensitive, ctx)
    }
  }

  private async _grepFallback(
    pattern: string,
    glob: string,
    caseInsensitive: boolean,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const includeFlag = glob ? `--include="${glob}"` : ""
    const caseFlag = caseInsensitive ? "-i" : ""
    const cmd = `grep -rn ${caseFlag} ${includeFlag} "${pattern.replace(/"/g, '\\"')}" .`

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: ctx.workspaceRoot,
        timeout: 30_000,
        maxBuffer: 1024 * 1024 * 5,
      })
      return stdout.trim() || `No matches found for pattern: ${pattern}`
    } catch (err: unknown) {
      const error = err as { code?: number }
      if (error.code === 1) {
        return `No matches found for pattern: ${pattern}`
      }
      throw new Error(`search_files: Failed to search — ${String(err)}`)
    }
  }
}
