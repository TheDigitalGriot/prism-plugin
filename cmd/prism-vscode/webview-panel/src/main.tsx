import React from 'react'
import ReactDOM from 'react-dom/client'
import { MonitorView } from './views/MonitorView'
import { WorkspacesView } from './views/WorkspacesView'
import './theme/panel.css'

const root = document.getElementById('root')!
const viewType = root.getAttribute('data-view') || 'monitor'

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {viewType === 'workspaces' ? <WorkspacesView /> : <MonitorView />}
  </React.StrictMode>
)
