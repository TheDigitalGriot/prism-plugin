import * as fs from "fs/promises"
import * as path from "path"
import { IToolHandler, ToolExecutionContext } from "../types"

export class ReadFileHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const filePath = input.path as string
    if (!filePath) {
      throw new Error("read_file: 'path' is required")
    }

    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(ctx.workspaceRoot, filePath)

    const content = await fs.readFile(resolved, "utf-8")
    const lines = content.split("\n")
    const lineCount = lines.length

    // Format output with line numbers (matching Prism CLI style)
    const numbered = lines
      .map((line, i) => `${String(i + 1).padStart(4, " ")}→${line}`)
      .join("\n")

    return `File: ${filePath} (${lineCount} lines)\n\n${numbered}`
  }
}
