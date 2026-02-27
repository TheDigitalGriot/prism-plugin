import React, { useEffect, useState } from 'react'
import type { AgentStatus, ExecutionRecord, MonitorState, QualityGate } from '../types/monitor'
import { StatusIcon } from '../components/StatusIcon'
import { KanbanBoard, type KanbanColumn } from '../components/KanbanBoard'
import { AgentCard } from '../components/AgentCard'
import { DataTable, type Column } from '../components/DataTable'
import { vscode } from '../vscodeApi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms === 0) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60_000)}m`
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

function formatLastRun(iso: string | undefined): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return formatTime(iso)
}

function agentKanbanColumns(agents: AgentStatus[]): KanbanColumn<AgentStatus>[] {
  const byStatus = (s: string) => agents.filter((a) => a.status === s)
  return [
    { id: 'active',   title: 'Active',   color: 'var(--prism-green)',  items: byStatus('active') },
    { id: 'thinking', title: 'Thinking', color: 'var(--prism-blue)',   items: byStatus('thinking') },
    { id: 'waiting',  title: 'Waiting',  color: 'var(--prism-amber)',  items: byStatus('waiting') },
    { id: 'done',     title: 'Done',     color: 'var(--vscode-descriptionForeground)', items: byStatus('done') },
    { id: 'paused',   title: 'Paused',   color: 'var(--vscode-disabledForeground, #666)', items: byStatus('paused') },
  ]
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function SystemHealth({ agents }: { agents: AgentStatus[] }): React.ReactElement {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <section className="panel-section monitor-section">
      <div className="panel-section-title">System Health</div>
      {agents.length === 0 ? (
        <div className="panel-empty">No agents running. Launch an agent from the Office panel.</div>
      ) : (
        <>
          <div className="health-summary">{agents.length} agent{agents.length !== 1 ? 's' : ''} active</div>
          <ul className="agent-list">
            {agents.map((a) => (
              <li key={a.id} className="agent-list-item">
                <StatusIcon status={a.status} size={8} />
                <span className="agent-list-type">{a.agentType}</span>
                {a.storyId && <span className="agent-list-story">{a.storyId}</span>}
                <span className="agent-list-status">{a.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="health-refresh">Last refresh: {now}</div>
    </section>
  )
}

const historyColumns: Column<ExecutionRecord>[] = [
  {
    key: 'story',
    label: 'Story',
    width: '40%',
    render: (r) => (
      <span className="history-story">
        <span className="history-story-id">{r.storyId}</span>
        <span className="history-story-title" title={r.storyTitle}>
          {r.storyTitle.length > 25 ? r.storyTitle.slice(0, 25) + '…' : r.storyTitle}
        </span>
      </span>
    ),
  },
  {
    key: 'result',
    label: '',
    width: '24px',
    render: (r) => <StatusIcon status={r.result} size={9} />,
  },
  {
    key: 'duration',
    label: 'Dur',
    width: '15%',
    render: (r) => <span className="mono-dim">{formatDuration(r.durationMs)}</span>,
  },
  {
    key: 'time',
    label: 'Time',
    width: '20%',
    render: (r) => <span className="mono-dim">{formatTime(r.completedAt)}</span>,
  },
]

function ExecutionHistory({ history }: { history: ExecutionRecord[] }): React.ReactElement {
  return (
    <section className="panel-section monitor-section">
      <div className="panel-section-title">Execution History</div>
      <DataTable
        columns={historyColumns}
        data={history}
        emptyText="No stories completed yet."
      />
    </section>
  )
}

function QualityGates({ gates }: { gates: QualityGate[] }): React.ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null)

  function runGate(command: string): void {
    vscode.postMessage({ type: 'runGate', command })
  }

  function runAll(): void {
    vscode.postMessage({ type: 'runAllGates' })
  }

  return (
    <section className="panel-section monitor-section">
      <div className="panel-section-title">Quality Gates</div>
      {gates.length === 0 ? (
        <div className="panel-empty">No quality gates configured. Add <code>qualityGates</code> to your stories.json plan.</div>
      ) : (
        <>
          <ul className="gate-list">
            {gates.map((gate) => (
              <li key={gate.command} className="gate-item">
                <div className="gate-row">
                  <button
                    className="gate-status-btn"
                    onClick={() => setExpanded(expanded === gate.command ? null : gate.command)}
                    title="Toggle output"
                  >
                    <StatusIcon status={gate.status} size={9} />
                  </button>
                  <span className="gate-command" title={gate.command}>{gate.name}</span>
                  <span className="gate-last-run">{formatLastRun(gate.lastRun)}</span>
                  <button
                    className="gate-run-btn"
                    onClick={() => runGate(gate.command)}
                    disabled={gate.status === 'running'}
                  >
                    {gate.status === 'running' ? '…' : 'Run'}
                  </button>
                </div>
                {expanded === gate.command && gate.output && (
                  <pre className="gate-output">{gate.output}</pre>
                )}
              </li>
            ))}
          </ul>
          <button className="gate-run-all-btn" onClick={runAll}>
            Run All
          </button>
        </>
      )}
    </section>
  )
}

function AgentKanban({ agents }: { agents: AgentStatus[] }): React.ReactElement {
  const columns = agentKanbanColumns(agents)
  return (
    <section className="panel-section monitor-section">
      <div className="panel-section-title">Agent Kanban</div>
      <KanbanBoard
        columns={columns}
        renderCard={(agent) => <AgentCard agent={agent} />}
        emptyText="No agents running. Launch an agent from the Office panel."
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Root view
// ---------------------------------------------------------------------------

export function MonitorView(): React.ReactElement {
  const [state, setState] = useState<MonitorState>({ agents: [], history: [], gates: [] })

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type: string; state?: MonitorState }
      if (msg.type === 'monitorState' && msg.state) {
        setState(msg.state)
      }
    }
    window.addEventListener('message', handler)
    // Signal ready — extension will push initial state
    vscode.postMessage({ type: 'webviewReady' })
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="monitor-root">
      <div className="monitor-grid">
        <SystemHealth agents={state.agents} />
        <ExecutionHistory history={state.history} />
        <QualityGates gates={state.gates} />
        <AgentKanban agents={state.agents} />
      </div>
    </div>
  )
}
