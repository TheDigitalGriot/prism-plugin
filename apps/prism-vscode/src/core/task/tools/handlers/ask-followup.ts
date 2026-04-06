import { IToolHandler, ToolExecutionContext } from "../types"

/**
 * AskFollowupHandler — signals the task to pause and wait for user input.
 *
 * The actual waiting mechanism is handled by PrismTask; this handler
 * simply validates input and formats the question for display.
 */
export class AskFollowupHandler implements IToolHandler {
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolExecutionContext,
  ): Promise<string> {
    const question = input.question as string
    if (!question) throw new Error("ask_followup: 'question' is required")

    // The task loop intercepts 'ask_followup' before calling execute()
    // and waits for user response via the approval system.
    // This fallback message is returned if no response was received.
    return `[Waiting for user response to: ${question}]`
  }
}
