import React from "react"

// ---------------------------------------------------------------------------
// Mock commit data (replaced by IPC in Phase 8)
// ---------------------------------------------------------------------------

interface MockCommit {
  hash: string
  msg: string
  author: string
  time: string
  refs: string[]
  color: string
  merge?: boolean
}

const MOCK_COMMITS: MockCommit[] = [
  {
    hash: "a3f7c2d",
    msg: "feat: settings search and reset functionality",
    author: "Claude",
    time: "2 min ago",
    refs: ["HEAD"],
    color: "var(--prism-green)",
  },
  {
    hash: "b8e1d4f",
    msg: "feat: general settings and keyboard shortcuts",
    author: "Claude",
    time: "25 min ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "c2a9f6e",
    msg: "feat: appearance settings panel with theme picker",
    author: "Claude",
    time: "1 hr ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "d5b3e8a",
    msg: "feat: settings page layout with categories",
    author: "Claude",
    time: "2 hr ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "e7c4f1b",
    msg: "feat: CSS custom properties migration",
    author: "Claude",
    time: "3 hr ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "f1d6a3c",
    msg: "feat: settings IPC bridge layer",
    author: "Claude",
    time: "4 hr ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "g9e2b5d",
    msg: "feat: settings state management store",
    author: "Claude",
    time: "5 hr ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "h4f8c7e",
    msg: "chore: phase 5 packaging and polish",
    author: "Gavin",
    time: "8 hr ago",
    refs: [],
    color: "var(--prism-teal)",
  },
  {
    hash: "i6a1d9f",
    msg: "feat: spectrum execution dashboard wiring",
    author: "Claude",
    time: "10 hr ago",
    refs: [],
    color: "var(--prism-green)",
  },
  {
    hash: "j2b5e3a",
    msg: "Merge branch 'main' into electron-ready",
    author: "Gavin",
    time: "12 hr ago",
    refs: [],
    color: "var(--prism-blue)",
    merge: true,
  },
  {
    hash: "k8c7f4b",
    msg: "chore: initial electron scaffold",
    author: "Gavin",
    time: "1 day ago",
    refs: ["main"],
    color: "var(--prism-blue)",
  },
]

// ---------------------------------------------------------------------------
// GitGraphView
// ---------------------------------------------------------------------------

export const GitGraphView: React.FC = () => {
  const commits = MOCK_COMMITS

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
      {/* Header: branch name + actions */}
      <div
        style={{
          padding: "0 24px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Branch icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--prism-amber)"
          strokeWidth="1.5"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--prism-fg)" }}>
          electron-ready
        </span>
        <span style={{ fontSize: 11, color: "var(--prism-text-dim)" }}>
          ahead of main by 9 commits
        </span>
        <div style={{ flex: 1 }} />
        {/* Action buttons */}
        {["Fetch", "Pull"].map((label) => (
          <span
            key={label}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 4,
              border: "1px solid var(--prism-border)",
              color: "var(--prism-fg-muted)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {label}
          </span>
        ))}
        <span
          style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 4,
            background: "var(--prism-teal)20",
            border: "1px solid var(--prism-teal)40",
            color: "var(--prism-teal)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          Push
        </span>
      </div>

      {/* Commit list */}
      <div>
        {commits.map((commit, i) => (
          <div
            key={commit.hash}
            style={{
              display: "flex",
              alignItems: "stretch",
              padding: "0 24px",
              cursor: "pointer",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--prism-bg-hover)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            {/* Graph lane */}
            <div
              style={{
                width: 40,
                minWidth: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
              }}
            >
              {/* Top connector line */}
              {i > 0 ? (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    background: commit.merge ? "var(--prism-blue)" : "var(--prism-green)",
                    opacity: 0.3,
                  }}
                />
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {/* Commit dot */}
              <div
                style={{
                  width: commit.merge ? 12 : 10,
                  height: commit.merge ? 12 : 10,
                  borderRadius: "50%",
                  background: commit.merge ? "none" : commit.color,
                  border: commit.merge ? "2px solid var(--prism-blue)" : "none",
                  zIndex: 2,
                  flexShrink: 0,
                }}
              />

              {/* Merge branch line */}
              {commit.merge && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: -8,
                    width: 20,
                    height: 2,
                    background: "var(--prism-blue)",
                    opacity: 0.3,
                  }}
                />
              )}

              {/* Bottom connector line */}
              {i < commits.length - 1 && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    background: commits[i + 1]?.merge
                      ? "var(--prism-blue)"
                      : "var(--prism-green)",
                    opacity: 0.3,
                  }}
                />
              )}
            </div>

            {/* Commit info */}
            <div style={{ flex: 1, padding: "8px 0 8px 12px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--prism-fg)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {commit.msg}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <code
                  style={{
                    fontSize: 10.5,
                    color: commit.color,
                    opacity: 0.8,
                    fontFamily: "var(--prism-font-code)",
                  }}
                >
                  {commit.hash}
                </code>
                <span style={{ fontSize: 10.5, color: "var(--prism-text-dim)" }}>
                  {commit.author}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--prism-text-dim)" }}>
                  {commit.time}
                </span>
                {commit.refs.map((ref) => (
                  <span
                    key={ref}
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background:
                        ref === "HEAD"
                          ? "var(--prism-green)20"
                          : "var(--prism-blue)20",
                      color:
                        ref === "HEAD" ? "var(--prism-green)" : "var(--prism-blue)",
                      fontWeight: 600,
                    }}
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
