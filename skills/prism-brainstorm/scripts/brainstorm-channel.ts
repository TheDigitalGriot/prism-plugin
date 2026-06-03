#!/usr/bin/env bun
/**
 * brainstorm-channel.ts — Persistent MCP channel server for the prism-brainstorm
 * visual companion. Registered in `.claude-plugin/plugin.json` so Claude Code spawns
 * it at plugin-load time over stdio.
 *
 * Architecture (Option C — persistent + session routing):
 *   Browser click → POST http://127.0.0.1:52342/channel → MCP notification → Claude wakes
 *
 * The HTTP server runs alongside the MCP stdio transport in the same Bun process.
 * Browser POSTs include `session_id` so Claude can disambiguate which brainstorm
 * session generated the click.
 *
 * Env:
 *   BRAINSTORM_CHANNEL_PORT  Override the HTTP port (default: 52342)
 *
 * Browser POST shape:
 *   {
 *     "session_id": "1234-1775635488",
 *     "content": "user clicked Option B",
 *     "choice": "B",
 *     "id": "fidelity-progression",
 *     ...other string fields become meta keys
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const DEFAULT_PORT = 52342
const CHANNEL_PORT =
  Number.parseInt(process.env.BRAINSTORM_CHANNEL_PORT ?? "", 10) || DEFAULT_PORT

const server = new Server(
  { name: "brainstorm-channel", version: "1.0.0" },
  {
    capabilities: {},
    instructions:
      "Receives wake events from the prism-brainstorm browser viewer. " +
      "Each notification's `session_id` meta key identifies which brainstorm session " +
      "generated the click. The `content` field is a human-readable summary. " +
      "When you receive a wake event, resume the brainstorm session for that session_id.",
  },
)

// Meta keys must be /^[A-Za-z0-9_]+$/ — hyphens are silently dropped by Claude Code.
const META_KEY_RE = /^[A-Za-z0-9_]+$/

// B1b: Session registry for multi-session routing.
// Maps session_id → true for active brainstorm sessions.
// If empty (single-session), all wake notifications fire unconditionally (backward compat).
const sessionRegistry = new Map<string, boolean>()

// B1d: Passive mode — set true if the claude/channel capability probe fails.
// In passive mode the events file still gets written by server.cjs (full local logging),
// but the MCP wake notification is suppressed. Requires Claude Code >= v2.1.80.
let passiveMode = false

function sanitizeMeta(input: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input || typeof input !== "object") return out
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (k === "content") continue
    if (!META_KEY_RE.test(k)) continue
    if (typeof v === "string") out[k] = v
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v)
  }
  return out
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

let httpServer: ReturnType<typeof Bun.serve> | null = null
try {
  httpServer = Bun.serve({
  port: CHANNEL_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return new Response(JSON.stringify({ ok: true, port: CHANNEL_PORT }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    // B1d: Status endpoint — exposes passiveMode so frame-template.html helper.js
    // can render a drawer indicator when active wake is unavailable.
    if (url.pathname === "/status" && req.method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, passive: passiveMode, port: CHANNEL_PORT }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      )
    }

    // B1b: Session registration endpoints.
    // POST /register  {session_id: string} — claim this session's routing slot.
    // POST /unregister {session_id: string} — release when brainstorm session ends.
    if (url.pathname === "/register" && req.method === "POST") {
      let body: Record<string, unknown>
      try { body = (await req.json()) as Record<string, unknown> } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        })
      }
      const sid = typeof body.session_id === "string" ? body.session_id : null
      if (sid) sessionRegistry.set(sid, true)
      return new Response(JSON.stringify({ ok: true, session_id: sid }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    if (url.pathname === "/unregister" && req.method === "POST") {
      let body: Record<string, unknown>
      try { body = (await req.json()) as Record<string, unknown> } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        })
      }
      const sid = typeof body.session_id === "string" ? body.session_id : null
      if (sid) sessionRegistry.delete(sid)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    if (url.pathname !== "/channel" || req.method !== "POST") {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    const meta = sanitizeMeta(body)

    // B1b: Session routing — if registry has entries, only fire for the registered session.
    // If registry is empty, fire unconditionally (single-session backward compat).
    const targetSession = typeof body.session_id === "string" ? body.session_id : null
    if (sessionRegistry.size > 0 && targetSession && !sessionRegistry.has(targetSession)) {
      // Wake signal targeted at a different session — silently drop.
      return new Response(JSON.stringify({ ok: true, routed: false }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    // B1d: Passive mode — events file is still written by server.cjs WS handler
    // (canonical event log). Wake notification is suppressed until capability is confirmed.
    if (passiveMode) {
      return new Response(JSON.stringify({ ok: true, passive: true }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      })
    }

    // B1a: Wake signal only — the events file at $STATE_DIR/events is the canonical
    // event log. Claude reads events on wake; the notification content is a minimal
    // wake signal, not the event payload.
    try {
      await server.notification({
        method: "notifications/message/create",
        params: {
          content: "Brainstorm viewer interaction — read events file for details",
          meta,
        },
      })
    } catch (err) {
      // Log but don't crash — the notification failing shouldn't break the HTTP response.
      // Common causes: stdio transport not connected yet, Claude Code doesn't support
      // this notification method, or the MCP connection was dropped.
      console.error("[brainstorm-channel] notification failed:", String(err))
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    })
  },
})
} catch (err) {
  // Port already in use or other startup failure — log but don't crash the MCP process.
  // The stdio transport should still work even if the HTTP listener fails.
  console.error("[brainstorm-channel] HTTP server failed to start:", String(err))
}

const transport = new StdioServerTransport()
await server.connect(transport)

// B1d: Capability probe — verify claude/channel notification is supported.
// Falls back to passive mode on runtimes < v2.1.80.
// In passive mode: events file still gets written by server.cjs (full local logging),
// but the MCP wake notification is suppressed.
try {
  await server.notification({
    method: "notifications/message/create",
    params: {
      content: "brainstorm-channel: capability probe",
      meta: { type: "probe" },
    },
  })
  // If we reach here, the channel is functional.
} catch {
  passiveMode = true
  console.error(
    "[brainstorm-channel] claude/channel not available — passive mode active (Claude Code < v2.1.80). " +
    "Events file will still be written; send a message to Claude to read your selections.",
  )
}
