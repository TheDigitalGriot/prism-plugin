import { IToolHandler, ToolExecutionContext } from "../types"

/**
 * AttemptCompletionHandler — signals that Claude has completed the task.
 *
 * PrismTask intercepts this tool call to update chat state and
 * stop the recursion. The handler itself just returns the result.
 */
export class AttemptCompletionHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolExecutionContext,
  ): Promise<string> {
    const result = input.result as string
    if (!result) throw new Error("attempt_completion: 'result' is required")

    const command = input.command as string | undefined

    return command
      ? `${result}\n\nDemo command: ${command}`
      : result
  }
}
