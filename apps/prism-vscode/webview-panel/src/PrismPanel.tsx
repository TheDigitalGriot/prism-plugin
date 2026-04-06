import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MonitorView } from './views/MonitorView'
import { WorkspacesView } from './views/WorkspacesView'
import { OfficeApp } from './views/OfficeApp'
import { ViewToggle } from './components/ViewToggle'
import { DraggableDivider } from './components/DraggableDivider'
import { StatusBar } from './components/StatusBar'
import { vscode } from './vscodeApi'

export function PrismPanel(): React.ReactElement {
  const [leftView, setLeftView] = useState<'monitor' | 'office'>('monitor')
  const [isDragging, setIsDragging] = useState(false)
  const [storyCount, setStoryCount] = useState(0)
  const [storyTotal, setStoryTotal] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [activeAgentCount, setActiveAgentCount] = useState(0)
  const [version, setVersion] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  // Ref tracks current divider position so handleMouseUp always reads latest value
  const dividerPosRef = useRef(55)
  const [dividerPos, _setDividerPos] = useState(55)

  const updateDividerPos = useCallback((pos: number) => {
    dividerPosRef.current = pos
    _setDividerPos(pos)
  }, [])

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    isDraggingRef.current = true
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = (x / rect.width) * 100
      updateDividerPos(Math.min(80, Math.max(25, pct)))
    },
    [updateDividerPos],
  )

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return
    setIsDragging(false)
    isDraggingRef.current = false
    vscode.postMessage({ type: 'dividerPositionChanged', value: dividerPosRef.current })
  }, [])

  // Attach / detach global listeners only while dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // ── Initial state from extension ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type: string; [key: string]: unknown }
      if (msg.type === 'initialState') {
        if (typeof msg.dividerPos === 'number') updateDividerPos(msg.dividerPos)
        if (msg.activeView === 'monitor' || msg.activeView === 'office') setLeftView(msg.activeView)
        if (typeof msg.storyCount === 'number') setStoryCount(msg.storyCount)
        if (typeof msg.storyTotal === 'number') setStoryTotal(msg.storyTotal)
        if (typeof msg.projectName === 'string') setProjectName(msg.projectName)
        if (typeof msg.activeAgentCount === 'number') setActiveAgentCount(msg.activeAgentCount)
        if (typeof msg.version === 'string') setVersion(msg.version)
      }
    }
    window.addEventListener('message', handler)
    // Signal panel is ready — extension will reply with initialState
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', handler)
  }, [updateDividerPos])

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const handleToggle = useCallback((view: 'monitor' | 'office') => {
    setLeftView(view)
    vscode.postMessage({ type: 'viewToggleChanged', value: view })
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="prism-panel-root">
      <div
        ref={containerRef}
        className="prism-main-content"
        style={{
          cursor: isDragging ? 'col-resize' : 'default',
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
        {/* Left Panel: Monitor or Office */}
        <div className="prism-left-panel" style={{ width: `${dividerPos}%` }}>
          <ViewToggle activeView={leftView} onToggle={handleToggle} activeAgentCount={activeAgentCount} />
          <div className="prism-view-content">
            {leftView === 'monitor' ? <MonitorView /> : <OfficeApp />}
          </div>
        </div>

        {/* Draggable divider */}
        <DraggableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

        {/* Right Panel: Workspaces */}
        <div className="prism-right-panel">
          <div className="prism-workspaces-header">
            <span
              style={{
                fontSize: 10,
                color: 'var(--prism-text-dim)',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Workspaces
            </span>
            <span className="prism-connection-status">● connected</span>
          </div>
          <div className="prism-view-content">
            <WorkspacesView />
          </div>
        </div>
      </div>

      <StatusBar storyCount={storyCount} storyTotal={storyTotal} projectName={projectName} version={version} />
    </div>
  )
}
