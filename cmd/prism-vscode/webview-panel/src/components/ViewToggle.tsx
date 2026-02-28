import React from 'react'

interface ViewToggleProps {
  activeView: 'monitor' | 'office'
  onToggle: (view: 'monitor' | 'office') => void
  activeAgentCount?: number
}

export function ViewToggle({ activeView, onToggle, activeAgentCount = 0 }: ViewToggleProps): React.ReactElement {
  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 2,
        borderBottom: '1px solid var(--prism-border)',
        background: 'var(--prism-bg-panel)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'var(--prism-text-dim)',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginRight: 8,
        }}
      >
        View
      </span>
      {(['monitor', 'office'] as const).map((view) => {
        const isActive = activeView === view
        return (
          <button
            key={view}
            onClick={() => onToggle(view)}
            style={{
              background: isActive ? 'var(--prism-bg-card)' : 'transparent',
              border: isActive ? '1px solid var(--prism-border-active)' : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 12px',
              fontSize: 10,
              color: isActive ? 'var(--prism-text)' : 'var(--prism-text-dim)',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ fontSize: 12 }}>{view === 'monitor' ? '◈' : '⌂'}</span>
            {view === 'monitor' ? 'Monitor' : 'Office'}
          </button>
        )
      })}
      {activeView === 'office' && activeAgentCount > 0 && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--prism-green)',
            }}
          />
          <span style={{ fontSize: 9, color: 'var(--prism-green)', fontFamily: 'monospace' }}>
            {activeAgentCount} active
          </span>
        </div>
      )}
    </div>
  )
}
