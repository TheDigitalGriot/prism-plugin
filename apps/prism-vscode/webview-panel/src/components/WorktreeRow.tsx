import React from 'react'
import type { WorktreeInfo } from '../types/workspaces'
import { StatusIcon } from './StatusIcon'
import { vscode } from '../vscodeApi'

interface WorktreeRowProps {
  worktree: WorktreeInfo
}

function typeIcon(wt: WorktreeInfo): string {
  if (wt.isBare) return '○'
  if (wt.isMain) return '●'
  return '▸'
}

function typeLabel(wt: WorktreeInfo): string {
  if (wt.isBare) return 'Bare'
  if (wt.isMain) return 'Main'
  return 'Linked'
}

export function WorktreeRow({ worktree }: WorktreeRowProps): React.ReactElement {
  function openWorktree(): void {
    vscode.postMessage({ type: 'openWorktree', path: worktree.path })
  }

  function deleteWorktree(): void {
    vscode.postMessage({
      type: 'deleteWorktree',
      path: worktree.path,
      branch: worktree.branch,
      deleteBranch: false,
    })
  }

  return (
    <div className="worktree-row">
      <span className={`worktree-type-icon${worktree.isMain ? ' worktree-type-icon--main' : ''}`}>
        {typeIcon(worktree)}
      </span>
      <div className="worktree-info">
        <div className="worktree-branch-row">
          <span className="worktree-branch">{worktree.branch}</span>
          <span className="worktree-type-label">{typeLabel(worktree)}</span>
          {worktree.agentStatus && (
            <span className="worktree-agent-badge">
              <StatusIcon status={worktree.agentStatus.status} size={7} />
              <span className="worktree-agent-type">{worktree.agentStatus.agentType}</span>
            </span>
          )}
        </div>
        <span className="worktree-head mono-dim">{worktree.head}</span>
      </div>
      <div className="worktree-actions">
        <button className="worktree-open-btn" onClick={openWorktree} title="Open in VSCode">
          Open
        </button>
        <button
          className="worktree-delete-btn"
          onClick={deleteWorktree}
          disabled={worktree.isMain}
          title={worktree.isMain ? 'Cannot delete main worktree' : 'Delete worktree'}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
