/**
 * Tool system types for PrismTask.
 *
 * Defines the tool enum, handler interface, and tool definitions
 * that are sent to the Claude API.
 */
import { ApiToolDefinition } from "@prism-core/core/api/types"

// ---------------------------------------------------------------------------
// Tool enum
// ---------------------------------------------------------------------------

export type PrismTool =
  | "read_file"
  | "write_file"
  | "edit_file"
  | "execute_command"
  | "search_files"
  | "list_files"
  | "ask_followup"
  | "attempt_completion"

/** Tools that require explicit user approval before executing. */
export const APPROVAL_REQUIRED_TOOLS = new Set<PrismTool>([
  "write_file",
  "edit_file",
  "execute_command",
])

/** Tools that are auto-approved based on settings. */
export function requiresApproval(
  tool: PrismTool,
  autoApproveSettings: { readFile?: boolean; listFiles?: boolean; searchFiles?: boolean },
): boolean {
  if (!APPROVAL_REQUIRED_TOOLS.has(tool)) {
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Tool handler interface
// ---------------------------------------------------------------------------

export interface ToolExecutionContext {
  workspaceRoot: string
  /** Callback to emit a result message to the chat. */
  emitResult: (result: string, isError?: boolean) => void
}

export interface IToolHandler {
  /** Execute the tool with the given input. Returns the result string. */
  execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string>
}

// ---------------------------------------------------------------------------
// Tool definitions (sent to Claude API)
// ---------------------------------------------------------------------------

export const PRISM_TOOL_DEFINITIONS: ApiToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the contents of a file from the filesystem. Use this to examine existing code, configuration files, or any other text files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to read. Can be absolute or relative to the workspace root.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with new content. Use this to create new files or completely replace existing ones.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to write. Can be absolute or relative to the workspace root.",
        },
        content: {
          type: "string",
          description: "The full content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Make a targeted edit to a file by replacing specific text. Use this for surgical changes rather than rewriting entire files.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to edit.",
        },
        old_string: {
          type: "string",
          description: "The exact text to find and replace. Must be unique within the file.",
        },
        new_string: {
          type: "string",
          description: "The text to replace the old_string with.",
        },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "execute_command",
    description: "Execute a shell command in the workspace. Use this to run tests, build scripts, or other CLI operations.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute.",
        },
        cwd: {
          type: "string",
          description: "Optional working directory for the command (defaults to workspace root).",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "search_files",
    description: "Search for a pattern across files in the workspace using regex. Returns matching lines with file paths and line numbers.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The regex pattern to search for.",
        },
        glob: {
          type: "string",
          description: "Optional glob pattern to filter files (e.g., '**/*.ts', '*.json').",
        },
        case_insensitive: {
          type: "string",
          description: "Set to 'true' for case-insensitive search.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a given path.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The directory path to list. Defaults to workspace root if not specified.",
        },
        recursive: {
          type: "string",
          description: "Set to 'true' to list recursively.",
        },
      },
    },
  },
  {
    name: "ask_followup",
    description: "Ask the user a clarifying question when you need more information to proceed. Use sparingly — only when the task is ambiguous and you genuinely need clarification.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question to ask the user.",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "attempt_completion",
    description: "Signal that you have completed the task. Provide a summary of what was accomplished.",
    input_schema: {
      type: "object",
      properties: {
        result: {
          type: "string",
          description: "A concise summary of what was accomplished.",
        },
        command: {
          type: "string",
          description: "Optional command to demonstrate the result (e.g., 'npm test', 'npm run build').",
        },
      },
      required: ["result"],
    },
  },
]
