import React from 'react'

export interface Column<T> {
  key: string
  label: string
  width?: string
  render: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyText?: string
}

export function DataTable<T>({ columns, data, emptyText }: DataTableProps<T>): React.ReactElement {
  if (data.length === 0) {
    return <div className="panel-empty">{emptyText ?? 'No data.'}</div>
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} className={i % 2 === 1 ? 'data-table-row-alt' : ''}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
