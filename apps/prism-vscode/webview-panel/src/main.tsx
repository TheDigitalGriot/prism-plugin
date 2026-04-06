import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrismPanel } from './PrismPanel'
import './theme/panel.css'
import { vscode } from './vscodeApi'
import { setOfficeTransport } from '@prism-ui/office/transport.js'

// Wire up the office transport for VSCode messaging
setOfficeTransport({
  postMessage: (msg) => vscode.postMessage(msg),
  onMessage: (handler) => {
    const listener = (e: MessageEvent) => handler(e.data)
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><PrismPanel /></React.StrictMode>
)
