import * as fs from "fs/promises"
import * as path from "path"
import { IToolHandler, ToolExecutionContext } from "../types"

const MAX_ENTRIES = 300

export class ListFilesHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const inputPath = (input.path as string) ?? "."
    const recursive = input.recursive === "true"

    const resolved = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(ctx.workspaceRoot, inputPath)

    const entries = recursive
      ? await this._listRecursive(resolved, resolved)
      : await this._listFlat(resolved)

    if (entries.length === 0) {
      return `Directory is empty: ${inputPath}`
    }

    const truncated = entries.length > MAX_ENTRIES
    const display = entries.slice(0, MAX_ENTRIES)

    return [
      `Contents of ${inputPath}:`,
      display.join("\n"),
      truncated ? `\n[Showing first ${MAX_ENTRIES} of ${entries.length} entries]` : "",
    ]
      .filter(Boolean)
      .join("\n")
  }

  private async _listFlat(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .sort((a, b) => {
        // Directories first
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
  }

  private async _listRecursive(dirPath: string, root: string): Promise<string[]> {
    const results: string[] = []
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      // Skip common noisy directories
      if (["node_modules", ".git", "dist", ".next", "__pycache__"].includes(entry.name)) {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(root, fullPath)

      if (entry.isDirectory()) {
        results.push(`${relativePath}/`)
        const children = await this._listRecursive(fullPath, root)
        results.push(...children)
      } else {
        results.push(relativePath)
      }

      if (results.length >= MAX_ENTRIES) break
    }

    return results
  }
}
