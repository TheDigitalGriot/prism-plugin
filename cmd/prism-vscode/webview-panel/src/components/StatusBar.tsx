import React from 'react'

interface StatusBarProps {
  storyCount: number
  storyTotal: number
  projectName: string
  status?: string
}

export function StatusBar({ storyCount, storyTotal, projectName, status = 'Idle' }: StatusBarProps): React.ReactElement {
  const pct = storyTotal > 0 ? Math.round((storyCount / storyTotal) * 100) : 0

  return (
    <div
      style={{
        height: 22,
        background: 'var(--prism-bg-deep)',
        borderTop: '1px solid var(--prism-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'monospace',
            background: 'linear-gradient(135deg, var(--prism-blue), var(--prism-teal), var(--prism-green))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          PRISM
        </span>
        <span style={{ fontSize: 9, color: 'var(--prism-text-muted)', fontFamily: 'monospace' }}>{status}</span>
      </div>
      {storyTotal > 0 && (
        <span style={{ fontSize: 9, color: 'var(--prism-text-muted)', fontFamily: 'monospace' }}>
          ☰ {storyCount}/{storyTotal} stories ({pct}%)
        </span>
      )}
      {projectName && (
        <span style={{ fontSize: 9, color: 'var(--prism-text-muted)', fontFamily: 'monospace' }}>{projectName}</span>
      )}
      <div style={{ flex: 1 }} />
    </div>
  )
}
