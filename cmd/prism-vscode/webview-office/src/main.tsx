import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/spectral-office.css'
import { vscode } from './vscodeApi.js'
import { setOfficeTransport } from '@prism-ui/office/transport.js'
import { OfficeApp } from '@prism-ui/office/OfficeApp.js'
import { OfficeErrorBoundary } from '@prism-ui/office/OfficeErrorBoundary.js'

setOfficeTransport({
  postMessage: (msg) => vscode.postMessage(msg),
  onMessage: (handler) => {
    const listener = (e: MessageEvent) => handler(e.data)
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OfficeErrorBoundary>
      <OfficeApp />
    </OfficeErrorBoundary>
  </StrictMode>,
)
