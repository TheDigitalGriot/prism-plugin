import React, { useState, useEffect } from "react"
import { useLayout } from "../../context/LayoutContext"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileNode {
  name: string
  type: "file" | "dir"
  children?: FileNode[]
  language?: string
}

// ---------------------------------------------------------------------------
// FileTree sub-component
// ---------------------------------------------------------------------------

interface FileTreeProps {
  items: FileNode[]
  depth?: number
  expandedMap: Record<string, boolean>
  onToggleDir: (name: string) => void
  onFileClick: (node: FileNode, path: string) => void
  pathPrefix?: string
}

const FileTree: React.FC<FileTreeProps> = ({
  items,
  depth = 0,
  expandedMap,
  onToggleDir,
  onFileClick,
  pathPrefix = "",
}) => {
  return (
    <div>
      {items.map((item, i) => {
        const fullPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name
        const isExpanded = expandedMap[fullPath] ?? (depth === 0)

        return (
          <div key={i}>
            <div
              onClick={() => {
                if (item.type === "dir") {
                  onToggleDir(fullPath)
                } else {
                  onFileClick(item, fullPath)
                }
              }}
              style={{
                padding: `3px 8px 3px ${12 + depth * 16}px`,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                color: "var(--prism-fg)",
                fontSize: 12.5,
                background: "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--prism-bg-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}
            >
              {item.type === "dir" && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                    flexShrink: 0,
                    color: "var(--prism-fg-muted)",
                  }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
              {item.type === "dir" ? (
                <span style={{ color: "var(--prism-teal)", opacity: 0.8, fontSize: 13 }}>📁</span>
              ) : (
                <span style={{ color: "var(--prism-fg-muted)", opacity: 0.7, fontSize: 13, marginLeft: item.type === "file" ? 12 : 0 }}>
                  📄
                </span>
              )}
              <span>{item.name}</span>
              {item.language && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 9,
                    color: "var(--prism-text-dim)",
                    opacity: 0.5,
                  }}
                >
                  {item.language}
                </span>
              )}
            </div>

            {item.type === "dir" && isExpanded && item.children && (
              <FileTree
                items={item.children}
                depth={depth + 1}
                expandedMap={expandedMap}
                onToggleDir={onToggleDir}
                onFileClick={onFileClick}
                pathPrefix={fullPath}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FilesPanel
// ---------------------------------------------------------------------------

export const FilesPanel: React.FC = () => {
  const layout = useLayout()
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    window.electronAPI?.invoke('prism:fileTree', { depth: 4 }).then((result) => {
      const res = result as { ok: boolean; tree?: FileNode[] }
      if (res.ok && res.tree) setFileTree(res.tree)
    })
  }, [])

  const handleToggleDir = (path: string) => {
    setExpandedMap((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  const handleFileClick = (node: FileNode, path: string) => {
    layout.openTab({
      id: "file:" + path,
      type: "file",
      label: node.name,
    })
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "4px 0",
      }}
    >
      {fileTree.length === 0 ? (
        <div style={{ padding: "12px", fontSize: 11, color: "var(--prism-fg-disabled)" }}>
          {window.electronAPI ? "Loading…" : "No project open"}
        </div>
      ) : (
        <FileTree
          items={fileTree}
          expandedMap={expandedMap}
          onToggleDir={handleToggleDir}
          onFileClick={handleFileClick}
        />
      )}
    </div>
  )
}
