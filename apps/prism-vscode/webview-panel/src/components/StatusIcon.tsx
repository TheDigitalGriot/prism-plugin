import React from 'react'

interface StatusIconProps {
  status: string
  size?: number
}

export function StatusIcon({ status, size = 10 }: StatusIconProps): React.ReactElement {
  const style: React.CSSProperties = { display: 'inline-block', width: size, height: size }

  switch (status) {
    case 'complete':
    case 'pass':
      return <span className="status-icon status-pass" style={style} title={status} />
    case 'error':
    case 'fail':
      return <span className="status-icon status-fail" style={style} title={status} />
    case 'running':
      return <span className="status-icon status-running" style={style} title="running" />
    case 'blocked':
    case 'pending':
      return <span className="status-icon status-pending" style={style} title={status} />
    case 'active':
      return <span className="status-icon status-active" style={style} title="active" />
    case 'thinking':
      return <span className="status-icon status-thinking" style={style} title="thinking" />
    case 'waiting':
      return <span className="status-icon status-waiting" style={style} title="waiting" />
    case 'paused':
    case 'done':
      return <span className="status-icon status-done" style={style} title={status} />
    case 'unknown':
    default:
      return <span className="status-icon status-unknown" style={style} title={status} />
  }
}
