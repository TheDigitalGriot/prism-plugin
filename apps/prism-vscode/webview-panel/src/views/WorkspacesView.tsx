import React, { useEffect, useState } from 'react'
import type { ProjectInfo, WorktreeInfo, WorkspacesState } from '../types/workspaces'
import type { AgentStatus } from '../types/monitor'
import { KanbanBoard, type KanbanColumn } from '../components/KanbanBoard'
import { AgentCard } from '../components/AgentCard'
import { ProjectCard } from '../components/ProjectCard'
import { WorktreeRow } from '../components/WorktreeRow'
import { NewWorktreeDialog } from '../components/NewWorktreeDialog'
import { vscode } from '../vscodeApi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build kanban columns from worktrees.
 * Worktrees with an agent get that agent's status column;
 * worktrees without an agent sit in "Waiting".
 */
function worktreeKanbanColumns(worktrees: WorktreeInfo[]): KanbanColumn<WorktreeInfo>[] {
  const withAgent = (status: string) =>
    worktrees.filter((wt) => wt.agentStatus?.status === status)
  const withoutAgent = worktrees.filter((wt) => !wt.agentStatus)

  return [
    { id: 'active',   title: 'Active',   color: 'var(--prism-green)',  items: withAgent('active') },
    { id: 'thinking', title: 'Thinking', color: 'var(--prism-blue)',   items: withAgent('thinking') },
    { id: 'waiting',  title: 'Waiting',  color: 'var(--prism-amber)',  items: [...withAgent('waiting'), ...withoutAgent] },
    { id: 'done',     title: 'Done',     color: 'var(--vscode-descriptionForeground)', items: withAgent('done') },
    { id: 'paused',   title: 'Paused',   color: 'var(--vscode-disabledForeground, #666)', items: withAgent('paused') },
  ]
}

/**
 * Synthesize AgentStatus objects from worktrees that have agent data —
 * used to populate the kanban renderCard with familiar AgentCard shape.
 */
function worktreeToAgentStatus(wt: WorktreeInfo, idx: number): AgentStatus {
  return {
    id: idx,
    agentType: wt.agentStatus?.agentType ?? 'claude',
    status: wt.agentStatus?.status ?? 'waiting',
    worktreePath: wt.path,
    storyId: undefined,
    storyTitle: undefined,
  }
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ProjectsSection({ projects, loading }: { projects: ProjectInfo[]; loading: boolean }): React.ReactElement {
  function pickWorkspace(): void {
    vscode.postMessage({ type: 'pickAndAddWorkspace' })
  }

  return (
    <section className="panel-section workspaces-section">
      <div className="panel-section-title">Projects</div>
      {loading ? (
        <div className="panel-empty">Discovering projects…</div>
      ) : projects.length === 0 ? (
        <div className="panel-empty">
          No sibling projects found. Add a workspace or create <code>.prism/</code> in a sibling directory.
        </div>
      ) : (
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.path}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
      <button className="workspaces-add-btn" onClick={pickWorkspace}>
        + Add Workspace…
      </button>
    </section>
  )
}

function WorktreesSection({ worktrees, loading }: { worktrees: WorktreeInfo[]; loading: boolean }): React.ReactElement {
  const [showDialog, setShowDialog] = useState(false)

  function refresh(): void {
    vscode.postMessage({ type: 'refresh' })
  }

  return (
    <section className="panel-section workspaces-section">
      <div className="panel-section-title-row">
        <div className="panel-section-title">Worktrees</div>
        <button className="worktrees-refresh-btn" onClick={refresh} title="Refresh worktrees">↻</button>
      </div>
      {loading ? (
        <div className="panel-empty">Loading worktrees…</div>
      ) : worktrees.length === 0 ? (
        <div className="panel-empty">
          Single worktree (main). Create a new worktree to work on a branch.
        </div>
      ) : (
        <ul className="worktree-list">
          {worktrees.map((wt) => (
            <li key={wt.path}>
              <WorktreeRow worktree={wt} />
            </li>
          ))}
        </ul>
      )}

      {showDialog ? (
        <NewWorktreeDialog onCancel={() => setShowDialog(false)} />
      ) : (
        <button className="workspaces-add-btn" onClick={() => setShowDialog(true)}>
          + New Worktree
        </button>
      )}
    </section>
  )
}

function WorktreeKanban({ worktrees }: { worktrees: WorktreeInfo[] }): React.ReactElement {
  const columns = worktreeKanbanColumns(worktrees)
  // Map WorktreeInfo → AgentStatus for AgentCard rendering
  const allItems = columns.flatMap((col) => col.items)
  const idxMap = new Map(allItems.map((wt, i) => [wt, i]))

  return (
    <section className="panel-section">
      <div className="panel-section-title">Agent Kanban</div>
      <KanbanBoard
        columns={columns}
        renderCard={(wt: WorktreeInfo) => (
          <AgentCard agent={worktreeToAgentStatus(wt, idxMap.get(wt) ?? 0)} />
        )}
        emptyText="No worktrees found. Create a worktree to get started."
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Root view
// ---------------------------------------------------------------------------

export function WorkspacesView(): React.ReactElement {
  const [state, setState] = useState<WorkspacesState>({ projects: [], worktrees: [], loading: true })

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type: string; state?: WorkspacesState }
      if (msg.type === 'workspacesState' && msg.state) {
        setState(msg.state)
      }
    }
    window.addEventListener('message', handler)
    // Signal ready — extension will push initial state
    vscode.postMessage({ type: 'webviewReady' })
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="workspaces-root">
      <div className="workspaces-top">
        <ProjectsSection projects={state.projects} loading={state.loading} />
        <WorktreesSection worktrees={state.worktrees} loading={state.loading} />
      </div>
      <WorktreeKanban worktrees={state.worktrees} />
    </div>
  )
}
