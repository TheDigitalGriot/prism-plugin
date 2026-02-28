/**
 * ActivityLog — timestamped tool activity + log entries with auto-scroll.
 */
import React, { useEffect, useRef } from "react"
import type { SpectrumLogEntry, SpectrumActivity } from "../../context/PrismStateContext"

// ---------------------------------------------------------------------------
// ActivityLog
// ---------------------------------------------------------------------------

interface ActivityLogProps {
  logs: SpectrumLogEntry[]
  recentActivities: SpectrumActivity[]
  /** Max height before scrolling. */
  maxHeight?: string
}

const LOG_COLORS: Record<string, string> = {
  info: "var(--prism-fg)",
  warn: "#f59e0b",
  error: "#ef4444",
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  logs,
  recentActivities,
  maxHeight = "180px",
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs.length, recentActivities.length])

  // Merge logs and recent activities into a unified timeline, sorted by ts
  const combined: Array<{ ts: number; text: string; color: string }> = [
    ...logs.map((l) => ({
      ts: l.ts,
      text: l.message,
      color: LOG_COLORS[l.level] ?? LOG_COLORS.info,
    })),
    ...recentActivities.map((a) => ({
      ts: a.ts,
      text: `\u2699 ${a.description}`,
      color: "var(--prism-fg-muted)",
    })),
  ].sort((a, b) => a.ts - b.ts)

  const visible = combined.slice(-100) // last 100 entries

  return (
    <div
      style={{
        maxHeight,
        overflowY: "auto",
        fontFamily: "var(--prism-font-mono)",
        fontSize: "11px",
        lineHeight: "1.6",
        padding: "4px 0",
      }}
    >
      {visible.length === 0 ? (
        <div style={{ color: "var(--prism-fg-muted)", padding: "4px 8px" }}>
          No activity yet\u2026
        </div>
      ) : (
        visible.map((entry, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: "8px",
              padding: "1px 8px",
              color: entry.color,
            }}
          >
            <span
              style={{
                color: "var(--prism-fg-muted)",
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              {formatTs(entry.ts)}
            </span>
            <span style={{ flex: 1, wordBreak: "break-word" }}>{entry.text}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
