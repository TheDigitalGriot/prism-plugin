import React, { useEffect, useRef } from "react"
import { useLayout } from "../../context/LayoutContext"
import { PixelOffice } from "../office/PixelOffice"

// ---------------------------------------------------------------------------
// Chevron icon
// ---------------------------------------------------------------------------

const ChevronDownIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

// ---------------------------------------------------------------------------
// Terminal output (mock)
// ---------------------------------------------------------------------------

const MOCK_TERMINAL_LINES = [
  "$ prism-cli spectrum --start",
  "[INFO] Loading stories.json...",
  "[INFO] Found 8 stories, 3 complete",
  "[INFO] Starting story STORY-004: Implement PixelOffice component",
  "[INFO] Spawning Claude session...",
  "[INFO] Claude session started (pid 12345)",
  "[RUN ] Running quality gates: npx tsc --noEmit",
  "[OK  ] TypeScript check passed",
  "[RUN ] Running quality gates: npm test",
  "[OK  ] Tests passed (42 passing)",
  "<spectrum-continue>",
  "[INFO] Story STORY-004 complete",
  "[INFO] Committing changes...",
  "[OK  ] Committed: d4a1b2c",
  "[INFO] Next: STORY-005",
  "▋",
]

const TerminalOutput: React.FC = () => {
  const scrollRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  return (
    <pre
      ref={scrollRef}
      style={{
        flex: 1,
        margin: 0,
        padding: "8px 12px",
        fontFamily: "var(--prism-font-code)",
        fontSize: 11,
        color: "var(--prism-fg-muted)",
        backgroundColor: "transparent",
        overflow: "auto",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}
    >
      {MOCK_TERMINAL_LINES.map((line, i) => {
        const isPrompt = line.startsWith("$")
        const isOk = line.startsWith("[OK")
        const isError = line.startsWith("[ERR")
        const isSignal = line.startsWith("<spectrum")
        const isCursor = line === "▋"

        return (
          <div
            key={i}
            style={{
              color: isPrompt
                ? "var(--prism-teal)"
                : isOk
                ? "var(--prism-green)"
                : isError
                ? "#ef4444"
                : isSignal
                ? "var(--prism-amber)"
                : isCursor
                ? "var(--prism-fg)"
                : undefined,
              animation: isCursor ? "prism-dot-pulse 1s step-end infinite" : undefined,
            }}
          >
            {line}
          </div>
        )
      })}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// BottomPanel — 180px collapsible panel with Office + Terminal tabs
// ---------------------------------------------------------------------------

export const BottomPanel: React.FC = () => {
  const { bottomTab, setBottomTab, toggleBottom } = useLayout()

  return (
    <div
      style={{
        height: 180,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--prism-bg-editor)",
        borderTop: "1px solid var(--prism-border)",
      }}
    >
      {/* Tab strip (30px) */}
      <div
        style={{
          height: 30,
          flexShrink: 0,
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid var(--prism-border)",
          paddingLeft: 4,
          gap: 0,
        }}
      >
        {(["office", "terminal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setBottomTab(tab)}
            style={{
              padding: "0 12px",
              border: "none",
              borderTop: bottomTab === tab ? "2px solid var(--prism-teal)" : "2px solid transparent",
              background: "transparent",
              color: bottomTab === tab ? "var(--prism-fg)" : "var(--prism-fg-muted)",
              fontSize: 11,
              fontWeight: bottomTab === tab ? 500 : 400,
              cursor: "pointer",
              textTransform: "capitalize",
              transition: "color 0.15s ease",
            }}
          >
            {tab === "office" ? "Office" : "Terminal"}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Connected status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            paddingRight: 8,
            fontSize: 10.5,
            color: "var(--prism-fg-muted)",
          }}
        >
          <span
            className="prism-dot-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "var(--prism-green)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          connected
        </div>

        {/* Collapse chevron */}
        <button
          onClick={toggleBottom}
          title="Collapse panel"
          style={{
            width: 28,
            height: "100%",
            border: "none",
            background: "transparent",
            color: "var(--prism-fg-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "color 0.15s ease",
          }}
        >
          <ChevronDownIcon />
        </button>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {bottomTab === "office" ? <PixelOffice /> : <TerminalOutput />}
      </div>
    </div>
  )
}
