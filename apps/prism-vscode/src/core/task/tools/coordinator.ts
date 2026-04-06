/**
 * ToolCoordinator — routes tool calls to their handlers.
 *
 * Instantiated once per PrismTask and holds a reference to all handlers.
 */
import { PrismTool, IToolHandler, ToolExecutionContext, APPROVAL_REQUIRED_TOOLS } from "./types"
import { ReadFileHandler } from "./handlers/read-file"
import { WriteFileHandler } from "./handlers/write-file"
import { EditFileHandler } from "./handlers/edit-file"
import { ExecuteCommandHandler } from "./handlers/execute-command"
import { SearchFilesHandler } from "./handlers/search-files"
import { ListFilesHandler } from "./handlers/list-files"
import { AskFollowupHandler } from "./handlers/ask-followup"
import { AttemptCompletionHandler } from "./handlers/attempt-completion"

export class ToolCoordinator {
  private readonly _handlers = new Map<PrismTool, IToolHandler>([
    ["read_file", new ReadFileHandler()],
    ["write_file", new WriteFileHandler()],
    ["edit_file", new EditFileHandler()],
    ["execute_command", new ExecuteCommandHandler()],
    ["search_files", new SearchFilesHandler()],
    ["list_files", new ListFilesHandler()],
    ["ask_followup", new AskFollowupHandler()],
    ["attempt_completion", new AttemptCompletionHandler()],
  ])

  /** Check if a tool name is known. */
  isKnownTool(name: string): name is PrismTool {
    return this._handlers.has(name as PrismTool)
  }

  /** Check if this tool needs explicit user approval. */
  requiresApproval(tool: PrismTool): boolean {
    return APPROVAL_REQUIRED_TOOLS.has(tool)
  }

  /**
   * Execute a tool.
   * Throws if the tool is unknown or the handler throws.
   */
  async execute(
    tool: PrismTool,
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    const handler = this._handlers.get(tool)
    if (!handler) {
      throw new Error(`Unknown tool: ${tool}`)
    }
    return handler.execute(input, ctx)
  }
}
