import React from 'react'

interface ProgressBarProps {
  /** Completion ratio 0–1 */
  value: number
  label?: string
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, label, size = 'md' }: ProgressBarProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(1, value))
  const pct = Math.round(clamped * 100)
  const height = size === 'sm' ? 4 : 6

  return (
    <div className="progress-bar-wrap">
      <div
        className="progress-bar-track"
        style={{ height }}
        title={`${pct}%`}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%`, height }}
        />
      </div>
      {label && (
        <span className="progress-bar-label">{label} ({pct}%)</span>
      )}
    </div>
  )
}
