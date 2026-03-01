import React, { useCallback, useEffect, useRef, useState } from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { CollapsibleSection } from "../common/CollapsibleSection"

// ---------------------------------------------------------------------------
// Types (mirrors packages/prism-core/src/workspace/types.ts)
// ---------------------------------------------------------------------------

interface EpicInfo {
  name: string
  storiesPath: string
  storyCount: number
  completedCount: number
}

interface ProjectInfo {
  name: string
  path: string
  branch: string
  storiesTotal: number
  storiesComplete: number
  epics: EpicInfo[]
  isCurrent: boolean
}

interface WorktreeInfo {
  path: string
  branch: string
  head: string
  isBare: boolean
  isMain: boolean
  prunable: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ProgressBar({ total, complete }: { total: number; complete: number }) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          flex: 1,
          height: 3,
          borderRadius: 2,
          background: "var(--prism-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 2,
            background: pct === 100 ? "var(--prism-green)" : "var(--prism-teal)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 9, color: "var(--prism-fg-disabled)", minWidth: 28, textAlign: "right" }}>
        {complete}/{total}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WorkspacePanel
// ---------------------------------------------------------------------------

export const WorkspacePanel: React.FC = () => {
  const state = usePrismState()

  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingWorktrees, setLoadingWorktrees] = useState(false)
  const [addingWorkspace, setAddingWorkspace] = useState(false)

  // New worktree form
  const [showNewWorktreeForm, setShowNewWorktreeForm] = useState(false)
  const [newBranchInput, setNewBranchInput] = useState("")
  const [creatingWorktree, setCreatingWorktree] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete confirmation
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null)
  const [deletingWorktree, setDeletingWorktree] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const newBranchRef = useRef<HTMLInputElement>(null)

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const result = (await window.electronAPI.invoke("prism:discoverProjects")) as ProjectInfo[]
      setProjects(Array.isArray(result) ? result : [])
    } catch {
      setProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  const loadWorktrees = useCallback(async () => {
    setLoadingWorktrees(true)
    try {
      const result = (await window.electronAPI.invoke("prism:listWorktrees")) as WorktreeInfo[]
      setWorktrees(Array.isArray(result) ? result : [])
    } catch {
      setWorktrees([])
    } finally {
      setLoadingWorktrees(false)
    }
  }, [])

  // Load on mount and when prismDir changes (new project opened)
  useEffect(() => {
    void loadProjects()
    void loadWorktrees()
  }, [loadProjects, loadWorktrees, state.prismDir])

  // Subscribe to file changes that might affect workspace/worktrees
  useEffect(() => {
    const unsub = window.electronAPI.on("prism:fileChange", () => {
      void loadProjects()
    })
    return unsub
  }, [loadProjects])

  // Focus input when new worktree form opens
  useEffect(() => {
    if (showNewWorktreeForm) {
      setTimeout(() => newBranchRef.current?.focus(), 50)
    }
  }, [showNewWorktreeForm])

  const handleAddWorkspace = useCallback(async () => {
    setAddingWorkspace(true)
    try {
      const result = (await window.electronAPI.invoke("prism:browseAndAddWorkspace")) as {
        ok: boolean
        path?: string
      }
      if (result.ok) {
        void loadProjects()
      }
    } finally {
      setAddingWorkspace(false)
    }
  }, [loadProjects])

  const handleCreateWorktree = useCallback(async () => {
    const branch = newBranchInput.trim()
    if (!branch) return
    setCreatingWorktree(true)
    setCreateError(null)
    try {
      const result = (await window.electronAPI.invoke("prism:createWorktree", branch)) as {
        ok: boolean
        error?: string
      }
      if (result.ok) {
        setShowNewWorktreeForm(false)
        setNewBranchInput("")
        void loadWorktrees()
      } else {
        setCreateError(result.error ?? "Failed to create worktree")
      }
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreatingWorktree(false)
    }
  }, [newBranchInput, loadWorktrees])

  const handleDeleteWorktree = useCallback(
    async (wt: WorktreeInfo) => {
      if (confirmDeletePath !== wt.path) {
        // First click: show confirmation
        setConfirmDeletePath(wt.path)
        setDeleteError(null)
        return
      }
      // Second click (confirmed): delete
      setDeletingWorktree(true)
      setDeleteError(null)
      try {
        const result = (await window.electronAPI.invoke(
          "prism:deleteWorktree",
          wt.path,
          false, // deleteBranch — keep branch by default
          wt.branch,
        )) as { ok: boolean; error?: string }
        if (result.ok) {
          setConfirmDeletePath(null)
          void loadWorktrees()
        } else {
          setDeleteError(result.error ?? "Failed to delete worktree")
        }
      } catch (err) {
        setDeleteError(String(err))
      } finally {
        setDeletingWorktree(false)
      }
    },
    [confirmDeletePath, loadWorktrees],
  )

  const handleOpenWorktree = useCallback(
    async (wtPath: string) => {
      await window.electronAPI.invoke("prism:switchProject", wtPath)
      void loadProjects()
      void loadWorktrees()
    },
    [loadProjects, loadWorktrees],
  )

  const handleNewBranchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") void handleCreateWorktree()
      if (e.key === "Escape") {
        setShowNewWorktreeForm(false)
        setNewBranchInput("")
        setCreateError(null)
      }
    },
    [handleCreateWorktree],
  )

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

      {/* Projects */}
      <CollapsibleSection title="Projects" defaultOpen>
        <div style={{ padding: "4px 12px" }}>
          {loadingProjects ? (
            <div style={{ fontSize: 11, color: "var(--prism-fg-disabled)", padding: "8px 0" }}>
              Discovering projects…
            </div>
          ) : projects.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--prism-fg-disabled)", padding: "8px 0" }}>
              No projects found. Open a project or add a workspace.
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.path}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: project.isCurrent
                    ? "1px solid var(--prism-teal)"
                    : "1px solid var(--prism-border)",
                  background: project.isCurrent
                    ? "rgba(var(--prism-teal-rgb, 0,200,180),0.04)"
                    : "rgba(255,255,255,0.02)",
                  marginBottom: 6,
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={project.isCurrent ? "var(--prism-teal)" : "var(--prism-fg-muted)"}
                    strokeWidth="1.5"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H11L9 5H5C3.9 5 3 5.9 3 7Z" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--prism-fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {project.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--prism-fg-disabled)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {project.path}
                    </div>
                  </div>
                  {project.isCurrent && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: "var(--prism-teal)",
                        background: "var(--prism-teal)20",
                        padding: "2px 6px",
                        borderRadius: 3,
                        letterSpacing: "0.05em",
                        flexShrink: 0,
                      }}
                    >
                      OPEN
                    </span>
                  )}
                </div>

                {/* Branch + stories */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--prism-fg-muted)",
                      fontFamily: "monospace",
                      background: "rgba(255,255,255,0.05)",
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    {project.branch}
                  </span>
                  {project.storiesTotal > 0 && (
                    <span style={{ fontSize: 10, color: "var(--prism-fg-disabled)" }}>
                      {project.storiesComplete}/{project.storiesTotal} stories
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {project.storiesTotal > 0 && (
                  <ProgressBar total={project.storiesTotal} complete={project.storiesComplete} />
                )}

                {/* Epics */}
                {project.epics.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {project.epics.map((epic) => (
                      <div
                        key={epic.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 3,
                          paddingLeft: 4,
                        }}
                      >
                        <span style={{ fontSize: 10, color: "var(--prism-fg-muted)", flex: 1 }}>
                          {epic.name}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--prism-fg-disabled)" }}>
                          {epic.completedCount}/{epic.storyCount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add Workspace button */}
          <button
            onClick={() => void handleAddWorkspace()}
            disabled={addingWorkspace}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 10px",
              borderRadius: 5,
              border: "1px dashed var(--prism-border)",
              background: "transparent",
              color: "var(--prism-fg-muted)",
              fontSize: 11,
              cursor: addingWorkspace ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            {addingWorkspace ? "Adding…" : "Add Workspace"}
          </button>

          {/* Refresh button */}
          <button
            onClick={() => void loadProjects()}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "4px 10px",
              borderRadius: 5,
              border: "none",
              background: "transparent",
              color: "var(--prism-fg-disabled)",
              fontSize: 10,
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </CollapsibleSection>

      {/* Worktrees */}
      <CollapsibleSection title="Worktrees" defaultOpen={false}>
        <div style={{ padding: "4px 12px" }}>
          {loadingWorktrees ? (
            <div style={{ fontSize: 11, color: "var(--prism-fg-disabled)", padding: "8px 0" }}>
              Loading worktrees…
            </div>
          ) : worktrees.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--prism-fg-disabled)", padding: "8px 0" }}>
              No worktrees found. Open a git project to see worktrees.
            </div>
          ) : (
            worktrees.map((wt) => (
              <div
                key={wt.path}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: wt.isMain
                    ? "1px solid var(--prism-teal)"
                    : "1px solid var(--prism-border)",
                  background: "rgba(255,255,255,0.02)",
                  marginBottom: 5,
                }}
              >
                {/* Branch + badges + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      color: wt.isMain ? "var(--prism-teal)" : "var(--prism-fg)",
                      fontWeight: wt.isMain ? 600 : 400,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {wt.branch}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "monospace",
                      color: "var(--prism-fg-disabled)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "1px 4px",
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  >
                    {wt.head}
                  </span>
                  {wt.isMain && (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        color: "var(--prism-teal)",
                        background: "var(--prism-teal)20",
                        padding: "1px 5px",
                        borderRadius: 3,
                        letterSpacing: "0.04em",
                        flexShrink: 0,
                      }}
                    >
                      MAIN
                    </span>
                  )}
                  {wt.prunable && (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        color: "var(--prism-amber)",
                        background: "var(--prism-amber)20",
                        padding: "1px 5px",
                        borderRadius: 3,
                        letterSpacing: "0.04em",
                        flexShrink: 0,
                      }}
                    >
                      PRUNABLE
                    </span>
                  )}
                </div>

                {/* Path */}
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--prism-fg-disabled)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: "monospace",
                    marginBottom: 6,
                  }}
                >
                  {wt.path}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 5 }}>
                  {/* Open / Switch project */}
                  <button
                    onClick={() => void handleOpenWorktree(wt.path)}
                    title="Switch project to this worktree"
                    style={{
                      flex: 1,
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--prism-border)",
                      background: "transparent",
                      color: "var(--prism-fg-muted)",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    Open
                  </button>

                  {/* Delete (only for non-main worktrees) */}
                  {!wt.isMain && (
                    <>
                      {confirmDeletePath === wt.path ? (
                        <>
                          <button
                            onClick={() => void handleDeleteWorktree(wt)}
                            disabled={deletingWorktree}
                            title="Confirm delete"
                            style={{
                              flex: 1,
                              padding: "3px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--prism-red, #f87171)",
                              background: "var(--prism-red, #f87171)20",
                              color: "var(--prism-red, #f87171)",
                              fontSize: 10,
                              cursor: deletingWorktree ? "not-allowed" : "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {deletingWorktree ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDeletePath(null)
                              setDeleteError(null)
                            }}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--prism-border)",
                              background: "transparent",
                              color: "var(--prism-fg-muted)",
                              fontSize: 10,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void handleDeleteWorktree(wt)}
                          title="Delete this worktree"
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--prism-border)",
                            background: "transparent",
                            color: "var(--prism-fg-muted)",
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Delete error */}
                {confirmDeletePath === wt.path && deleteError && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 9,
                      color: "var(--prism-red, #f87171)",
                      fontFamily: "monospace",
                    }}
                  >
                    {deleteError}
                  </div>
                )}
              </div>
            ))
          )}

          {/* New Worktree form */}
          {showNewWorktreeForm ? (
            <div
              style={{
                marginTop: 6,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--prism-border)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--prism-fg-muted)", marginBottom: 6 }}>
                Branch name for new worktree:
              </div>
              <input
                ref={newBranchRef}
                value={newBranchInput}
                onChange={(e) => setNewBranchInput(e.target.value)}
                onKeyDown={handleNewBranchKeyDown}
                placeholder="feature/my-branch"
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--prism-border)",
                  background: "var(--prism-bg-input, rgba(255,255,255,0.06))",
                  color: "var(--prism-fg)",
                  fontSize: 11,
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                  marginBottom: 6,
                  outline: "none",
                }}
              />
              {createError && (
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--prism-red, #f87171)",
                    fontFamily: "monospace",
                    marginBottom: 6,
                  }}
                >
                  {createError}
                </div>
              )}
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  onClick={() => void handleCreateWorktree()}
                  disabled={creatingWorktree || !newBranchInput.trim()}
                  style={{
                    flex: 1,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid var(--prism-teal)",
                    background: "var(--prism-teal)20",
                    color: "var(--prism-teal)",
                    fontSize: 11,
                    cursor: creatingWorktree || !newBranchInput.trim() ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {creatingWorktree ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowNewWorktreeForm(false)
                    setNewBranchInput("")
                    setCreateError(null)
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid var(--prism-border)",
                    background: "transparent",
                    color: "var(--prism-fg-muted)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowNewWorktreeForm(true)
                setCreateError(null)
              }}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "6px 10px",
                borderRadius: 5,
                border: "1px dashed var(--prism-border)",
                background: "transparent",
                color: "var(--prism-fg-muted)",
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              New Worktree
            </button>
          )}

          <button
            onClick={() => void loadWorktrees()}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "4px 10px",
              borderRadius: 5,
              border: "none",
              background: "transparent",
              color: "var(--prism-fg-disabled)",
              fontSize: 10,
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </CollapsibleSection>
    </div>
  )
}
