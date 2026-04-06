import * as fs from "fs/promises"
import * as path from "path"
import { IToolHandler, ToolExecutionContext } from "../types"

export class EditFileHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const filePath = input.path as string
    const oldString = input.old_string as string
    const newString = input.new_string as string

    if (!filePath) throw new Error("edit_file: 'path' is required")
    if (oldString === undefined) throw new Error("edit_file: 'old_string' is required")
    if (newString === undefined) throw new Error("edit_file: 'new_string' is required")

    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(ctx.workspaceRoot, filePath)

    const content = await fs.readFile(resolved, "utf-8")

    if (!content.includes(oldString)) {
      throw new Error(
        `edit_file: Could not find the string to replace in ${filePath}.\n` +
          `The 'old_string' must match exactly (including whitespace and indentation).`,
      )
    }

    // Count occurrences to ensure uniqueness
    const occurrences = content.split(oldString).length - 1
    if (occurrences > 1) {
      throw new Error(
        `edit_file: Found ${occurrences} occurrences of old_string in ${filePath}. ` +
          `Provide more context to make it unique.`,
      )
    }

    const newContent = content.replace(oldString, newString)
    await fs.writeFile(resolved, newContent, "utf-8")

    return `Successfully edited ${filePath}`
  }
}
