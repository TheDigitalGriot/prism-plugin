/**
 * prism-design-studio — design engine sidecar
 *
 * This module is the bridge between the prism skill system and the
 * prism-design-engine (forked open-design). It:
 *   1. Resolves the engine binary from the sibling repo
 *   2. Spawns it as a child process on the configured port
 *   3. Exposes a minimal REST relay for the prism VSCode extension
 *   4. Watches .prism/shared/designs/ for new artifacts
 *
 * The engine itself lives at: ~/Developer/prism-design-engine
 * Fork source: https://github.com/TheDigitalGriot/prism-design-engine
 * Upstream:    https://github.com/nexu-io/open-design
 */

import { spawn, execSync } from 'child_process'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ENGINE_REPO   = path.resolve(__dirname, '..', '..', '..', '..', 'prism-design-engine')
const ENGINE_DAEMON = path.join(ENGINE_REPO, 'apps', 'daemon')
const RELAY_PORT    = 7457  // prism's relay sits one above the engine's 7456
const ENGINE_PORT   = 7456

let engineProcess = null

// ── launch ───────────────────────────────────────────────────────────────────

export function launchEngine({ noOpen = true } = {}) {
  if (engineProcess) return { status: 'already-running', port: ENGINE_PORT }

  if (!fs.existsSync(ENGINE_DAEMON)) {
    throw new Error(`prism-design-engine not found at ${ENGINE_REPO}. Clone TheDigitalGriot/prism-design-engine first.`)
  }

  const args = ['run', noOpen ? 'daemon' : 'start']
  engineProcess = spawn('pnpm', args, {
    cwd: ENGINE_DAEMON,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      OD_PORT: String(ENGINE_PORT),
      OD_DEFAULT_DESIGN_SYSTEM: 'griotwave',
    },
  })

  engineProcess.on('exit', () => { engineProcess = null })
  return { status: 'starting', port: ENGINE_PORT }
}

export function stopEngine() {
  if (engineProcess) { engineProcess.kill('SIGTERM'); engineProcess = null }
}

// ── relay server (for VSCode extension) ──────────────────────────────────────

export function startRelay() {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')

    if (req.url === '/status' && req.method === 'GET') {
      const running = !!engineProcess
      res.end(JSON.stringify({ running, port: ENGINE_PORT, relay: RELAY_PORT }))
      return
    }

    if (req.url === '/launch' && req.method === 'POST') {
      try { const result = launchEngine(); res.end(JSON.stringify(result)) }
      catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })) }
      return
    }

    if (req.url === '/stop' && req.method === 'POST') {
      stopEngine(); res.end(JSON.stringify({ status: 'stopped' }))
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: 'not found' }))
  })

  server.listen(RELAY_PORT, '127.0.0.1', () => {
    console.log(`[prism-design-studio] relay listening on http://127.0.0.1:${RELAY_PORT}`)
    console.log(`[prism-design-studio] engine expected at http://localhost:${ENGINE_PORT}`)
  })

  return server
}

// ── main ─────────────────────────────────────────────────────────────────────

const noOpen = process.argv.includes('--no-open')
startRelay()
if (!noOpen) launchEngine()
