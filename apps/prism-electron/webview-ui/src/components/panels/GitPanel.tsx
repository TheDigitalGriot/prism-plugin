import React, { useState, useEffect } from "react"
import { useLayout } from "../../context/LayoutContext"
import { CollapsibleSection } from "../common/CollapsibleSection"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitChange {
  file: string
  status: "M" | "A" | "D" | string
  staged: boolean
}

interface BranchInfo {
  branch: string
  ahead: number
  behind: number
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const COLOR: Record<string, string> = {
    M: "var(--prism-amber)",
    A: "var(--prism-green)",
    D: "var(--prism-red)",
  }
  const color = COLOR[status] ?? "var(--prism-fg-muted)"

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        background: color + "20",
        padding: "1px 5px",
        borderRadius: 3,
        flexShrink: 0,
        minWidth: 18,
        textAlign: "center",
      }}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Change item
// ---------------------------------------------------------------------------

const ChangeItem: React.FC<{ change: GitChange }> = ({ change }) => {
  const fileName = change.file.split("/").pop() ?? change.file
  const dirPath = change.file.includes("/")
    ? change.file.substring(0, change.file.lastIndexOf("/"))
    : ""

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px",
        cursor: "default",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--prism-bg-hover)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent"
      }}
    >
      <StatusBadge status={change.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "var(--prism-fg)" }}>{fileName}</span>
        {dirPath && (
          <span style={{ fontSize: 10, color: "var(--prism-fg-disabled)", marginLeft: 4 }}>
            {dirPath}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GitPanel
// ---------------------------------------------------------------------------

export const GitPanel: React.FC = () => {
  const layout = useLayout()
  const [staged, setStaged] = useState<GitChange[]>([])
  const [unstaged, setUnstaged] = useState<GitChange[]>([])
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)
  const [commitCount, setCommitCount] = useState<number>(0)

  const fetchGitData = () => {
    const api = window.electronAPI
    if (!api) return

    api.invoke('prism:gitStatus').then((result) => {
      const res = result as {
        ok: boolean
        staged?: Array<{ path: string; status: string }>
        unstaged?: Array<{ path: string; status: string }>
      }
      if (res.ok) {
        setStaged((res.staged ?? []).map((c) => ({ file: c.path, status: c.status, staged: true })))
        setUnstaged((res.unstaged ?? []).map((c) => ({ file: c.path, status: c.status, staged: false })))
      }
    })

    api.invoke('prism:gitBranchInfo').then((result) => {
      const res = result as { ok: boolean; branch?: string; ahead?: number; behind?: number }
      if (res.ok && res.branch) {
        setBranchInfo({ branch: res.branch, ahead: res.ahead ?? 0, behind: res.behind ?? 0 })
      }
    })

    api.invoke('prism:gitLog', { limit: 50 }).then((result) => {
      const res = result as { ok: boolean; commits?: unknown[] }
      if (res.ok && res.commits) setCommitCount(res.commits.length)
    })
  }

  useEffect(() => {
    fetchGitData()
  }, [])

  const totalChanges = staged.length + unstaged.length

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* Source Control header */}
      <div style={{ padding: "10px 12px 6px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--prism-fg-muted)",
            }}
          >
            Source Control
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--prism-fg-disabled)",
              background: "rgba(255,255,255,0.05)",
              padding: "1px 6px",
              borderRadius: 8,
            }}
          >
            {totalChanges}
          </span>
        </div>

        {/* View Git Graph button */}
        <button
          onClick={() =>
            layout.openTab({ id: "git:graph", type: "git", label: "Git Graph" })
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "8px 10px",
            borderRadius: 5,
            border: "1px solid var(--prism-border)",
            background: "rgba(255,255,255,0.02)",
            cursor: "pointer",
            marginBottom: 8,
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--prism-border-active)"
            e.currentTarget.style.background = "var(--prism-bg-hover)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--prism-border)"
            e.currentTarget.style.background = "rgba(255,255,255,0.02)"
          }}
        >
          {/* Branch icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--prism-teal)"
            strokeWidth="1.5"
          >
            <circle cx="6" cy="6" r="2" />
            <circle cx="18" cy="18" r="2" />
            <circle cx="6" cy="18" r="2" />
            <path d="M6 8v10M18 16V8a4 4 0 00-4-4H8" />
          </svg>
          <span style={{ flex: 1, fontSize: 12, color: "var(--prism-teal)", textAlign: "left" }}>
            View Git Graph
          </span>
          {commitCount > 0 && (
            <span
              style={{
                fontSize: 10,
                color: "var(--prism-teal)",
                background: "var(--prism-teal)20",
                padding: "1px 6px",
                borderRadius: 8,
              }}
            >
              {commitCount}
            </span>
          )}
        </button>

        {/* Branch name */}
        {branchInfo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--prism-fg-muted)",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="6" cy="6" r="2" />
              <circle cx="6" cy="18" r="2" />
              <path d="M6 8v8" />
              <path d="M18 8a4 4 0 01-4 4H6" />
            </svg>
            <span>{branchInfo.branch}</span>
            {(branchInfo.ahead > 0 || branchInfo.behind > 0) && (
              <span style={{ color: "var(--prism-fg-disabled)", fontSize: 10 }}>
                ↑{branchInfo.ahead} ↓{branchInfo.behind}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Staged Changes */}
      <CollapsibleSection title="Staged Changes" defaultOpen badge={staged.length || undefined}>
        {staged.length === 0 ? (
          <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--prism-fg-disabled)" }}>
            No staged changes
          </div>
        ) : (
          staged.map((change, i) => <ChangeItem key={i} change={change} />)
        )}
      </CollapsibleSection>

      {/* Changes */}
      <CollapsibleSection title="Changes" defaultOpen badge={unstaged.length || undefined}>
        {unstaged.length === 0 ? (
          <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--prism-fg-disabled)" }}>
            No unstaged changes
          </div>
        ) : (
          unstaged.map((change, i) => <ChangeItem key={i} change={change} />)
        )}
      </CollapsibleSection>
    </div>
  )
}
