import { exec } from "child_process"
import * as path from "path"
import { promisify } from "util"
import { IToolHandler, ToolExecutionContext } from "../types"

const execAsync = promisify(exec)

const MAX_OUTPUT_LENGTH = 10_000
const TIMEOUT_MS = 60_000

export class ExecuteCommandHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const command = input.command as string
    if (!command) throw new Error("execute_command: 'command' is required")

    const cwd = input.cwd
      ? path.isAbsolute(input.cwd as string)
        ? (input.cwd as string)
        : path.join(ctx.workspaceRoot, input.cwd as string)
      : ctx.workspaceRoot

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      })

      const output = [
        stdout && `STDOUT:\n${stdout}`,
        stderr && `STDERR:\n${stderr}`,
      ]
        .filter(Boolean)
        .join("\n")
        .trim()

      if (!output) {
        return `Command executed successfully (no output): ${command}`
      }

      if (output.length > MAX_OUTPUT_LENGTH) {
        return output.slice(0, MAX_OUTPUT_LENGTH) + `\n\n[Output truncated — ${output.length} chars total]`
      }

      return `Command: ${command}\n\n${output}`
    } catch (err: unknown) {
      const error = err as { message?: string; stdout?: string; stderr?: string; code?: number }
      const parts: string[] = [`Command failed: ${command}`]
      if (error.code !== undefined) parts.push(`Exit code: ${error.code}`)
      if (error.stdout) parts.push(`STDOUT:\n${error.stdout}`)
      if (error.stderr) parts.push(`STDERR:\n${error.stderr}`)
      throw new Error(parts.join("\n"))
    }
  }
}
