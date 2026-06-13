import React, { useState, useEffect, useCallback } from 'react'
import type { DesignEngineState, DesignArtifact } from '../types/design'
import { vscode } from '../vscodeApi'

// ─── helpers ────────────────────────────────────────────────────────────────

const ENGINE_PORT = 7456

function statusColor(s: DesignEngineState['status']): string {
  return { stopped: 'var(--prism-text-dim)', starting: 'var(--prism-yellow)', running: 'var(--prism-green)', error: 'var(--prism-red)' }[s]
}

function artifactIcon(type: DesignArtifact['type']): string {
  return { md: '◻', pen: '✏', html: '⬡', pdf: '⬛', pptx: '◈', mp4: '▶', zip: '◪', yaml: '⊟' }[type] ?? '◻'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function EngineStatusCard({ state, onLaunch, onStop }: {
  state: DesignEngineState
  onLaunch: () => void
  onStop: () => void
}): React.ReactElement {
  const isRunning = state.status === 'running'
  const isStarting = state.status === 'starting'

  return (
    <div style={{
      background: 'var(--prism-bg-card)',
      border: '1px solid var(--prism-border)',
      borderRadius: 6,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(state.status), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--prism-text)', fontWeight: 600 }}>
          Prism Design Engine
        </div>
        <div style={{ fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace', marginTop: 2 }}>
          {isRunning
            ? `Running · localhost:${state.port}${state.version ? ` · v${state.version}` : ''}`
            : state.status === 'starting' ? 'Starting…'
            : state.status === 'error' ? (state.errorMessage ?? 'Engine error')
            : 'Stopped · click to launch'}
        </div>
      </div>
      {isRunning ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <a
            href={`http://localhost:${state.port}`}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 9, fontFamily: 'monospace', color: 'var(--prism-green)',
              textDecoration: 'none', padding: '3px 8px',
              border: '1px solid var(--prism-green)', borderRadius: 3,
            }}
          >
            Open ↗
          </a>
          <button onClick={onStop} style={{
            fontSize: 9, fontFamily: 'monospace', cursor: 'pointer',
            color: 'var(--prism-text-dim)', background: 'transparent',
            padding: '3px 8px', border: '1px solid var(--prism-border)', borderRadius: 3,
          }}>
            Stop
          </button>
        </div>
      ) : (
        <button onClick={onLaunch} disabled={isStarting} style={{
          fontSize: 9, fontFamily: 'monospace', cursor: isStarting ? 'default' : 'pointer',
          color: isStarting ? 'var(--prism-text-dim)' : 'var(--prism-accent)',
          background: 'transparent', padding: '3px 10px',
          border: `1px solid ${isStarting ? 'var(--prism-border)' : 'var(--prism-accent)'}`,
          borderRadius: 3, opacity: isStarting ? 0.6 : 1,
        }}>
          {isStarting ? 'Starting…' : 'Launch'}
        </button>
      )}
    </div>
  )
}

function ArtifactRow({ artifact }: { artifact: DesignArtifact }): React.ReactElement {
  const handleOpen = () => vscode.postMessage({ type: 'openDesignArtifact', path: artifact.path })

  return (
    <div
      onClick={handleOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 1fr 48px 60px',
        gap: 8,
        alignItems: 'center',
        padding: '7px 12px',
        cursor: 'pointer',
        borderTop: '1px solid var(--prism-border)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--prism-bg-card)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      <span style={{ fontSize: 11, color: 'var(--prism-text-dim)', textAlign: 'center' }}>{artifactIcon(artifact.type)}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--prism-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artifact.topic}
        </div>
        <div style={{ fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace', marginTop: 1 }}>
          {artifact.name}
        </div>
      </div>
      <span style={{ fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace', textAlign: 'right' }}>
        {artifact.sizeKb}kb
      </span>
      <span style={{ fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace', textAlign: 'right' }}>
        {formatDate(artifact.date)}
      </span>
    </div>
  )
}

function EmptyArtifacts(): React.ReactElement {
  return (
    <div style={{ padding: '24px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--prism-text-dim)', fontFamily: 'monospace' }}>
        No design artifacts yet.
      </div>
      <div style={{ fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace', marginTop: 6, opacity: 0.6 }}>
        Run /prism-design to generate the first one.
      </div>
    </div>
  )
}

// ─── main view ───────────────────────────────────────────────────────────────

const DEFAULT_STATE: DesignEngineState = {
  status: 'stopped',
  port: ENGINE_PORT,
  version: '',
  artifacts: [],
  latestDesignPrompt: null,
  latestLedger: null,
  activeSession: null,
}

export function DesignView(): React.ReactElement {
  const [state, setState] = useState<DesignEngineState>(DEFAULT_STATE)
  const [promptExpanded, setPromptExpanded] = useState(false)

  // ── message bus ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type: string; [key: string]: unknown }
      if (msg.type === 'designEngineState') {
        setState(msg.state as DesignEngineState)
      }
    }
    window.addEventListener('message', handler)
    vscode.postMessage({ type: 'requestDesignEngineState' })
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleLaunch = useCallback(() => {
    setState((s) => ({ ...s, status: 'starting' }))
    vscode.postMessage({ type: 'launchDesignEngine' })
  }, [])

  const handleStop = useCallback(() => {
    vscode.postMessage({ type: 'stopDesignEngine' })
  }, [])

  const handleSendPrompt = useCallback(() => {
    if (!state.latestDesignPrompt) return
    vscode.postMessage({ type: 'sendDesignPrompt', yaml: state.latestDesignPrompt })
  }, [state.latestDesignPrompt])

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* header */}
      <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--prism-border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--prism-text-dim)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Design Studio
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* engine status */}
        <EngineStatusCard state={state} onLaunch={handleLaunch} onStop={handleStop} />

        {/* design prompt card (from idea_init) */}
        {state.latestDesignPrompt && (
          <div style={{
            background: 'var(--prism-bg-card)', border: '1px solid var(--prism-border)',
            borderRadius: 6, marginBottom: 12, overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderBottom: promptExpanded ? '1px solid var(--prism-border)' : 'none',
              cursor: 'pointer',
            }} onClick={() => setPromptExpanded((v) => !v)}>
              <div>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--prism-accent)', fontWeight: 600 }}>
                  design_prompt.yaml
                </span>
                <span style={{ fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace', marginLeft: 8 }}>
                  from idea_init
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {state.status === 'running' && (
                  <button onClick={(e) => { e.stopPropagation(); handleSendPrompt() }} style={{
                    fontSize: 9, fontFamily: 'monospace', cursor: 'pointer',
                    color: 'var(--prism-accent)', background: 'transparent',
                    padding: '2px 8px', border: '1px solid var(--prism-accent)', borderRadius: 3,
                  }}>
                    Send →
                  </button>
                )}
                <span style={{ fontSize: 10, color: 'var(--prism-text-dim)' }}>{promptExpanded ? '▴' : '▾'}</span>
              </div>
            </div>
            {promptExpanded && (
              <pre style={{
                margin: 0, padding: '10px 12px', fontSize: 9, fontFamily: 'monospace',
                color: 'var(--prism-text-dim)', overflowX: 'auto', maxHeight: 180,
                lineHeight: 1.6, whiteSpace: 'pre',
              }}>
                {state.latestDesignPrompt.slice(0, 1200)}{state.latestDesignPrompt.length > 1200 ? '\n…' : ''}
              </pre>
            )}
          </div>
        )}

        {/* artifacts */}
        <div style={{ fontSize: 10, color: 'var(--prism-text-dim)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Design Artifacts
          <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--prism-text-dim)', opacity: 0.6 }}>
            .prism/shared/designs/
          </span>
        </div>

        <div style={{ background: 'var(--prism-bg-card)', border: '1px solid var(--prism-border)', borderRadius: 6, overflow: 'hidden' }}>
          {state.artifacts.length > 0
            ? state.artifacts.map((a) => <ArtifactRow key={a.path} artifact={a} />)
            : <EmptyArtifacts />
          }
        </div>

        {/* ledger link */}
        {state.latestLedger && (
          <div style={{ marginTop: 10, fontSize: 9, color: 'var(--prism-text-dim)', fontFamily: 'monospace' }}>
            <span style={{ opacity: 0.5 }}>ledger → </span>
            <span
              style={{ color: 'var(--prism-accent)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => vscode.postMessage({ type: 'openFile', path: state.latestLedger })}
            >
              {state.latestLedger.split('/').pop()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
