import React from 'react'

export function WorkspacesView(): React.ReactElement {
  return (
    <div style={{ padding: '12px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Prism Workspaces</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div className="panel-section">
          <div className="panel-section-title">Projects</div>
          <div className="panel-empty">Discovering projects...</div>
        </div>
        <div className="panel-section">
          <div className="panel-section-title">Worktrees</div>
          <div className="panel-empty">Loading worktrees...</div>
        </div>
      </div>
      <div className="panel-section">
        <div className="panel-section-title">Agent Kanban</div>
        <div className="panel-empty">No agents running.</div>
      </div>
    </div>
  )
}
