/**
 * window-state.ts — Persist and restore window bounds + last opened project.
 *
 * Saves to `app.getPath('userData')/prism-window-state.json`.
 * Uses plain fs (no electron-store) to avoid ESM compatibility issues.
 */

import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  lastProjectDir?: string
}

const DEFAULT: WindowState = { width: 1200, height: 800 }

function statePath(): string {
  return path.join(app.getPath('userData'), 'prism-window-state.json')
}

/** Load the last-saved window state. Returns defaults if not found. */
export function loadWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WindowState>
    return {
      width: parsed.width ?? DEFAULT.width,
      height: parsed.height ?? DEFAULT.height,
      x: parsed.x,
      y: parsed.y,
      lastProjectDir: parsed.lastProjectDir,
    }
  } catch {
    return { ...DEFAULT }
  }
}

/** Save current window bounds and optional last project directory. */
export function saveWindowState(win: BrowserWindow, lastProjectDir?: string): void {
  const bounds = win.getBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    lastProjectDir,
  }
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Non-critical — window state is best-effort
  }
}
