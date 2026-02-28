import React from "react"

// ---------------------------------------------------------------------------
// Mock file content (replaced by IPC in Phase 8)
// ---------------------------------------------------------------------------

const MOCK_LINES = [
  `import { BrowserWindow, ipcMain, dialog } from 'electron';`,
  `import { handleGrpcRequest } from '@prism-core/core/controller/grpc-handler';`,
  `import { ElectronPrismController } from './ElectronPrismController';`,
  ``,
  `export class ElectronIPCBridge {`,
  `  private controller: ElectronPrismController;`,
  `  private _currentProjectDir: string | undefined;`,
  ``,
  `  constructor(private mainWindow: BrowserWindow) {`,
  `    this.controller = new ElectronPrismController();`,
  `    this.controller.setPostMessageFn(async (msg) => {`,
  `      mainWindow.webContents.send('grpc_response', msg);`,
  `    });`,
  `    this._registerHandlers();`,
  `  }`,
  ``,
  `  async setProjectDir(dir: string): Promise<void> {`,
  `    this._currentProjectDir = dir;`,
  `    await this.controller.setProjectDir(dir);`,
  `  }`,
  ``,
  `  private _registerHandlers(): void {`,
  `    ipcMain.handle('grpc_request', async (_, request) => {`,
  `      await handleGrpcRequest(`,
  `        async (msg) => this.mainWindow.webContents.send('grpc_response', msg),`,
  `        request`,
  `      );`,
  `    });`,
  `  }`,
  ``,
  `  dispose(): void {`,
  `    this.controller.dispose();`,
  `  }`,
  `}`,
]

// ---------------------------------------------------------------------------
// Basic keyword syntax highlighting
// ---------------------------------------------------------------------------

function highlightLine(line: string): React.ReactNode {
  if (!line) return "\u00A0"

  // Comments
  if (line.trimStart().startsWith("//")) {
    return <span style={{ color: "var(--prism-text-dim)" }}>{line}</span>
  }

  // Build segments with keyword coloring
  const segments: React.ReactNode[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    // String literals (single or double quotes)
    const strMatch = remaining.match(/^(.*?)(['"])(.*?)\2/)
    if (strMatch) {
      const [full, before, quote, content] = strMatch
      if (before) {
        segments.push(...highlightKeywords(before, key))
        key += 10
      }
      segments.push(
        <span key={key++} style={{ color: "var(--prism-green)" }}>
          {quote}
          {content}
          {quote}
        </span>,
      )
      remaining = remaining.slice(full.length)
      continue
    }

    // No more strings — highlight remaining keywords
    segments.push(...highlightKeywords(remaining, key))
    break
  }

  return <>{segments}</>
}

const KEYWORDS_PURPLE = /\b(import|from)\b/g
const KEYWORDS_BLUE =
  /\b(class|async|private|export|const|function|return|await|void|new)\b/g

function highlightKeywords(text: string, baseKey: number): React.ReactNode[] {
  const result: React.ReactNode[] = []
  let lastIndex = 0
  let key = baseKey

  // Combine both patterns by scanning manually
  const tokens: Array<{ index: number; length: number; color: string }> = []

  let m: RegExpExecArray | null
  KEYWORDS_PURPLE.lastIndex = 0
  while ((m = KEYWORDS_PURPLE.exec(text)) !== null) {
    tokens.push({ index: m.index, length: m[0].length, color: "var(--prism-purple)" })
  }
  KEYWORDS_BLUE.lastIndex = 0
  while ((m = KEYWORDS_BLUE.exec(text)) !== null) {
    tokens.push({ index: m.index, length: m[0].length, color: "var(--prism-blue)" })
  }

  tokens.sort((a, b) => a.index - b.index)

  for (const token of tokens) {
    if (token.index < lastIndex) continue // overlapping
    if (token.index > lastIndex) {
      result.push(
        <span key={key++} style={{ color: "var(--prism-fg)" }}>
          {text.slice(lastIndex, token.index)}
        </span>,
      )
    }
    result.push(
      <span key={key++} style={{ color: token.color }}>
        {text.slice(token.index, token.index + token.length)}
      </span>,
    )
    lastIndex = token.index + token.length
  }

  if (lastIndex < text.length) {
    result.push(
      <span key={key++} style={{ color: "var(--prism-fg)" }}>
        {text.slice(lastIndex)}
      </span>,
    )
  }

  return result
}

// ---------------------------------------------------------------------------
// FileContentView
// ---------------------------------------------------------------------------

export const FileContentView: React.FC<{ filePath: string }> = ({ filePath }) => {
  // Phase 8 replaces mock with IPC data
  const lines = MOCK_LINES
  const fileName = filePath.split("/").pop() ?? filePath

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        fontFamily: "var(--prism-font-code)",
        fontSize: 12.5,
        lineHeight: 1.7,
      }}
    >
      {/* File path header */}
      <div
        style={{
          padding: "8px 16px",
          fontSize: 11,
          color: "var(--prism-fg-muted)",
          borderBottom: "1px solid var(--prism-border)",
          background: "rgba(255,255,255,0.01)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--prism-purple)"
          strokeWidth="1.5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span>{fileName}</span>
        <span style={{ color: "var(--prism-text-dim)", fontSize: 10 }}>
          {filePath}
        </span>
      </div>

      {/* Code lines */}
      <div style={{ padding: "12px 0" }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              paddingRight: 16,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--prism-bg-hover)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            <span
              style={{
                width: 48,
                minWidth: 48,
                textAlign: "right",
                paddingRight: 16,
                color: "var(--prism-text-dim)",
                userSelect: "none",
                fontSize: 11.5,
              }}
            >
              {i + 1}
            </span>
            <span style={{ whiteSpace: "pre" }}>{highlightLine(line)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
