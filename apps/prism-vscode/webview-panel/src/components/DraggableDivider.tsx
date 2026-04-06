import React from 'react'

interface DraggableDividerProps {
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

export function DraggableDivider({ isDragging, onMouseDown }: DraggableDividerProps): React.ReactElement {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 5,
        cursor: 'col-resize',
        background: isDragging ? 'var(--prism-blue)' : 'var(--prism-border)',
        transition: isDragging ? 'none' : 'background 0.15s',
        position: 'relative',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Grip indicator – 3 vertical dots */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          opacity: isDragging ? 1 : 0.4,
          transition: 'opacity 0.15s',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: isDragging ? '#fff' : 'var(--prism-text-dim)',
            }}
          />
        ))}
      </div>
      {/* Wider invisible hit target */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -4,
          right: -4,
          cursor: 'col-resize',
        }}
      />
    </div>
  )
}
