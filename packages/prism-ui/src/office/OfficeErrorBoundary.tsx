import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Error boundary that catches canvas/renderer crashes in the office sub-app.
 * Renders a minimal fallback UI and allows the user to retry.
 */
export class OfficeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[Prism Office] Renderer crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: 'var(--prism-fg-muted, #888)',
            fontFamily: 'var(--prism-font, sans-serif)',
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.5 }}>⚠</div>
          <div style={{ fontWeight: 600, color: 'var(--prism-fg, #ccc)' }}>
            Office renderer crashed
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'var(--prism-fg-disabled, #666)',
              maxWidth: 280,
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 4,
              padding: '4px 14px',
              borderRadius: 4,
              border: '1px solid var(--prism-border, #444)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--prism-fg-muted, #aaa)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
