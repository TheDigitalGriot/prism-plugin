import { useState, useEffect } from 'react'
import type { OfficeState } from '../../engine/officeState.js'
import type { AgentStoryContext } from '../../hooks/useExtensionMessages.js'
import { TILE_SIZE, CharacterState } from '../../types.js'

interface StoryLabelsProps {
  officeState: OfficeState
  agentStories: Record<number, AgentStoryContext>
  containerRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  panRef: React.RefObject<{ x: number; y: number }>
}

/**
 * StoryLabels — renders spectral teal story ID pills above Prism-managed
 * characters during Spectrum execution. Positions are derived from the same
 * canvas coordinate math used by ToolOverlay and AgentLabels.
 */
export function StoryLabels({
  officeState,
  agentStories,
  containerRef,
  zoom,
  panRef,
}: StoryLabelsProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    let rafId = 0
    const tick = () => {
      setTick((n) => n + 1)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const el = containerRef.current
  if (!el || !panRef.current) return null

  const agentIds = Object.keys(agentStories).map(Number)
  if (agentIds.length === 0) return null

  const rect = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const canvasW = Math.round(rect.width * dpr)
  const canvasH = Math.round(rect.height * dpr)
  const layout = officeState.getLayout()
  const mapW = layout.cols * TILE_SIZE * zoom
  const mapH = layout.rows * TILE_SIZE * zoom
  const pan = panRef.current
  const deviceOffsetX = Math.floor((canvasW - mapW) / 2) + Math.round(pan.x)
  const deviceOffsetY = Math.floor((canvasH - mapH) / 2) + Math.round(pan.y)

  return (
    <>
      {agentIds.map((id) => {
        const ch = officeState.characters.get(id)
        if (!ch) return null
        const story = agentStories[id]
        if (!story) return null

        const sittingOffset = ch.state === CharacterState.TYPE ? 6 : 0
        const screenX = (deviceOffsetX + ch.x * zoom) / dpr
        // Position above the character, above the agent name label (which is ~16px above the sprite)
        const screenY = (deviceOffsetY + (ch.y + sittingOffset - 40) * zoom) / dpr

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY - 20,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 41,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: '#14B8A6',
                background: 'rgba(15, 23, 42, 0.88)',
                border: '1px solid #14B8A6',
                padding: '1px 6px',
                borderRadius: 2,
                whiteSpace: 'nowrap',
              }}
              title={story.storyTitle}
            >
              {story.storyId}
            </span>
          </div>
        )
      })}
    </>
  )
}
