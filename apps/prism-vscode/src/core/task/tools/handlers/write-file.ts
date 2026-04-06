import * as fs from "fs/promises"
import * as path from "path"
import { IToolHandler, ToolExecutionContext } from "../types"

export class WriteFileHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const filePath = input.path as string
    const content = input.content as string

    if (!filePath) throw new Error("write_file: 'path' is required")
    if (content === undefined) throw new Error("write_file: 'content' is required")

    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(ctx.workspaceRoot, filePath)

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, content, "utf-8")

    const lines = content.split("\n").length
    return `Successfully wrote ${lines} lines to ${filePath}`
  }
}
