import React, { useState, useEffect } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Commit {
  hash: string
  shortHash: string
  author: string
  time: string
  message: string
  refs: string
  color: string
  merge: boolean
}

interface BranchInfo {
  branch: string
  ahead: number
  behind: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith("HEAD -> ") ? "HEAD" : r))
}

function commitColor(message: string, author: string): string {
  if (message.toLowerCase().startsWith("merge")) return "var(--prism-blue)"
  if (author.toLowerCase() === "claude") return "var(--prism-green)"
  return "var(--prism-teal)"
}

// ---------------------------------------------------------------------------
// GitGraphView
// ---------------------------------------------------------------------------

export const GitGraphView: React.FC = () => {
  const [commits, setCommits] = useState<Commit[]>([])
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.invoke('prism:gitLog', { limit: 50 }).then((result) => {
      const res = result as {
        ok: boolean
        commits?: Array<{ hash: string; shortHash: string; author: string; time: string; message: string; refs: string }>
      }
      if (res.ok && res.commits) {
        setCommits(
          res.commits.map((c) => ({
            ...c,
            color: commitColor(c.message, c.author),
            merge: c.message.toLowerCase().startsWith("merge"),
          })),
        )
      }
    })

    api.invoke('prism:gitBranchInfo').then((result) => {
      const res = result as { ok: boolean; branch?: string; ahead?: number; behind?: number }
      if (res.ok && res.branch) {
        setBranchInfo({ branch: res.branch, ahead: res.ahead ?? 0, behind: res.behind ?? 0 })
      }
    })
  }, [])

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
          {branchInfo?.branch ?? "Loading…"}
        </span>
        {branchInfo && (branchInfo.ahead > 0 || branchInfo.behind > 0) && (
          <span style={{ fontSize: 11, color: "var(--prism-text-dim)" }}>
            {branchInfo.ahead > 0 && `↑${branchInfo.ahead} ahead`}
            {branchInfo.ahead > 0 && branchInfo.behind > 0 && ", "}
            {branchInfo.behind > 0 && `↓${branchInfo.behind} behind`}
          </span>
        )}
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
        {commits.map((commit, i) => {
          const refs = parseRefs(commit.refs)
          return (
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
                    {commit.message}
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
                    {commit.shortHash}
                  </code>
                  <span style={{ fontSize: 10.5, color: "var(--prism-text-dim)" }}>
                    {commit.author}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--prism-text-dim)" }}>
                    {commit.time}
                  </span>
                  {refs.map((ref) => (
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
          )
        })}
        {commits.length === 0 && (
          <div style={{ padding: "24px", fontSize: 12, color: "var(--prism-fg-disabled)", textAlign: "center" }}>
            {window.electronAPI ? "Loading commits…" : "No project open"}
          </div>
        )}
      </div>
    </div>
  )
}
