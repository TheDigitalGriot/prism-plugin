import React from 'react'

export interface KanbanColumn<T> {
  id: string
  title: string
  color: string
  items: T[]
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[]
  renderCard: (item: T) => React.ReactNode
  emptyText?: string
}

export function KanbanBoard<T>({ columns, renderCard, emptyText }: KanbanBoardProps<T>): React.ReactElement {
  const totalItems = columns.reduce((acc, col) => acc + col.items.length, 0)

  if (totalItems === 0 && emptyText) {
    return <div className="panel-empty">{emptyText}</div>
  }

  return (
    <div className="kanban-board">
      {columns.map((col) => (
        <div key={col.id} className="kanban-column">
          <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
            <span className="kanban-column-title" style={{ color: col.color }}>{col.title}</span>
            <span className="kanban-column-count">{col.items.length}</span>
          </div>
          <div className="kanban-column-items">
            {col.items.length === 0 ? (
              <div className="kanban-empty">—</div>
            ) : (
              col.items.map((item, i) => (
                <div key={i} className="kanban-card">
                  {renderCard(item)}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
