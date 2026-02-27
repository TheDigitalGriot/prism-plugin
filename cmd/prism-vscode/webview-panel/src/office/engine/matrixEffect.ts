import type { Character, SpriteData } from '../types.js'
import { MATRIX_EFFECT_DURATION } from '../types.js'
import {
  MATRIX_TRAIL_LENGTH,
  MATRIX_SPRITE_COLS,
  MATRIX_SPRITE_ROWS,
  MATRIX_FLICKER_FPS,
  MATRIX_FLICKER_VISIBILITY_THRESHOLD,
  MATRIX_COLUMN_STAGGER_RANGE,
  MATRIX_HEAD_COLOR,
  MATRIX_TRAIL_BRIGHT,
  MATRIX_TRAIL_MID,
  MATRIX_TRAIL_DIM,
  MATRIX_TRAIL_OVERLAY_ALPHA,
  MATRIX_TRAIL_EMPTY_ALPHA,
  MATRIX_TRAIL_MID_THRESHOLD,
  MATRIX_TRAIL_DIM_THRESHOLD,
} from '../../office-constants.js'

/** Parse a hex color string to its r,g,b components as a comma-separated string for use in rgba() */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

const BRIGHT_RGB = hexToRgb(MATRIX_TRAIL_BRIGHT)
const MID_RGB = hexToRgb(MATRIX_TRAIL_MID)
const DIM_RGB = hexToRgb(MATRIX_TRAIL_DIM)

/** Hash-based flicker: ~70% visible for shimmer effect */
function flickerVisible(col: number, row: number, time: number): boolean {
  const t = Math.floor(time * MATRIX_FLICKER_FPS)
  const hash = ((col * 7 + row * 13 + t * 31) & 0xff)
  return hash < MATRIX_FLICKER_VISIBILITY_THRESHOLD
}

function generateSeeds(): number[] {
  const seeds: number[] = []
  for (let i = 0; i < MATRIX_SPRITE_COLS; i++) {
    seeds.push(Math.random())
  }
  return seeds
}

export { generateSeeds as matrixEffectSeeds }

/**
 * Render a character with a Matrix-style digital rain spawn/despawn effect.
 * Per-pixel rendering: each column sweeps top-to-bottom with a bright head and fading green trail.
 */
export function renderMatrixEffect(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  spriteData: SpriteData,
  drawX: number,
  drawY: number,
  zoom: number,
): void {
  const progress = ch.matrixEffectTimer / MATRIX_EFFECT_DURATION
  const isSpawn = ch.matrixEffect === 'spawn'
  const time = ch.matrixEffectTimer
  const totalSweep = MATRIX_SPRITE_ROWS + MATRIX_TRAIL_LENGTH

  for (let col = 0; col < MATRIX_SPRITE_COLS; col++) {
    // Stagger: each column starts at a slightly different time
    const stagger = (ch.matrixEffectSeeds[col] ?? 0) * MATRIX_COLUMN_STAGGER_RANGE
    const colProgress = Math.max(0, Math.min(1, (progress - stagger) / (1 - MATRIX_COLUMN_STAGGER_RANGE)))
    const headRow = colProgress * totalSweep

    for (let row = 0; row < MATRIX_SPRITE_ROWS; row++) {
      const pixel = spriteData[row]?.[col]
      const hasPixel = pixel && pixel !== ''
      const distFromHead = headRow - row
      const px = drawX + col * zoom
      const py = drawY + row * zoom

      if (isSpawn) {
        // Spawn: head sweeps down revealing character pixels
        if (distFromHead < 0) {
          // Above head: invisible
          continue
        } else if (distFromHead < 1) {
          // Head pixel: bright white-green
          ctx.fillStyle = MATRIX_HEAD_COLOR
          ctx.fillRect(px, py, zoom, zoom)
        } else if (distFromHead < MATRIX_TRAIL_LENGTH) {
          // Trail zone: show character pixel with green overlay, or just green if no pixel
          const trailPos = distFromHead / MATRIX_TRAIL_LENGTH
          if (hasPixel) {
            // Draw original pixel
            ctx.fillStyle = pixel
            ctx.fillRect(px, py, zoom, zoom)
            // Blue overlay that fades as trail progresses (spectral blue)
            const blueAlpha = (1 - trailPos) * MATRIX_TRAIL_OVERLAY_ALPHA
            if (flickerVisible(col, row, time)) {
              ctx.fillStyle = `rgba(${BRIGHT_RGB}, ${blueAlpha})`
              ctx.fillRect(px, py, zoom, zoom)
            }
          } else {
            // No character pixel: fading blue trail
            if (flickerVisible(col, row, time)) {
              const alpha = (1 - trailPos) * MATRIX_TRAIL_EMPTY_ALPHA
              ctx.fillStyle = trailPos < MATRIX_TRAIL_MID_THRESHOLD ? `rgba(${BRIGHT_RGB}, ${alpha})`
                : trailPos < MATRIX_TRAIL_DIM_THRESHOLD ? `rgba(${MID_RGB}, ${alpha})`
                  : `rgba(${DIM_RGB}, ${alpha})`
              ctx.fillRect(px, py, zoom, zoom)
            }
          }
        } else {
          // Below trail: normal character pixel
          if (hasPixel) {
            ctx.fillStyle = pixel
            ctx.fillRect(px, py, zoom, zoom)
          }
        }
      } else {
        // Despawn: head sweeps down consuming character pixels
        if (distFromHead < 0) {
          // Above head: normal character pixel (not yet consumed)
          if (hasPixel) {
            ctx.fillStyle = pixel
            ctx.fillRect(px, py, zoom, zoom)
          }
        } else if (distFromHead < 1) {
          // Head pixel: bright white-green
          ctx.fillStyle = MATRIX_HEAD_COLOR
          ctx.fillRect(px, py, zoom, zoom)
        } else if (distFromHead < MATRIX_TRAIL_LENGTH) {
          // Trail zone: fading blue (spectral)
          if (flickerVisible(col, row, time)) {
            const trailPos = distFromHead / MATRIX_TRAIL_LENGTH
            const alpha = (1 - trailPos) * MATRIX_TRAIL_EMPTY_ALPHA
            ctx.fillStyle = trailPos < MATRIX_TRAIL_MID_THRESHOLD ? `rgba(${BRIGHT_RGB}, ${alpha})`
              : trailPos < MATRIX_TRAIL_DIM_THRESHOLD ? `rgba(${MID_RGB}, ${alpha})`
                : `rgba(${DIM_RGB}, ${alpha})`
            ctx.fillRect(px, py, zoom, zoom)
          }
        }
        // Below trail: nothing (consumed)
      }
    }
  }
}
