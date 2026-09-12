#!/usr/bin/env bun
/**
 * digital-griot-mcp.ts — Persistent MCP channel + tool server for the Digital Griot
 * ecosystem bus. Registered in `.claude-plugin/plugin.json` so Claude Code spawns it
 * at plugin-load time over stdio.
 *
 * This server was generalized from the prism-brainstorm-only `brainstorm-channel`. It is
 * now the ONE shared wire that multiple Griot surfaces POST to on 127.0.0.1:52342. The
 * core relay is surface-agnostic: it forwards any wake POST with arbitrary string `meta`.
 * Surfaces disambiguate via `meta` (there is no per-surface branch in the relay):
 *
 *   - prism-brainstorm POSTs { content, session_id, choice, element_id }        (unchanged)
 *   - prism-gavel      POSTs { content, session_id, skill:"gavel",
 *                              verb:"scan|open|commit|verify", card_id, use, role, stage }
 *
 * The `skill` meta key (when present) tells Claude, on wake, which surface fired the
 * event — a plain gavel wake carries `skill:"gavel"`. All of these are underscore/alpha
 * keys, so they pass through `sanitizeMeta` unchanged (hyphenated keys are dropped).
 *
 * Architecture (Option C — persistent + session routing):
 *   Browser click → POST http://127.0.0.1:52342/channel → MCP notification → Claude wakes
 *
 * The HTTP server runs alongside the MCP stdio transport in the same Bun process.
 * Browser POSTs include `session_id` so Claude can disambiguate which session generated
 * the click.
 *
 * In addition to the wake relay, this server exposes six real MCP tools for prism-gavel
 * (gavel_state, gavel_decide, gavel_open, gavel_scan, gavel_commit, gavel_verify) so
 * other clients (Desktop, CLI) can drive the gavel cockpit directly. Tool DEFINITIONS
 * (name/description/inputSchema) are complete; the deep handler bodies are wired in S4.
 *
 * Env:
 *   BRAINSTORM_CHANNEL_PORT  Override the HTTP port (default: 52342).
 *                            NOTE: env var name and default 52342 are the PORT CONTRACT
 *                            the brainstorm popout (server.cjs/helper.js) depends on —
 *                            do not rename or change the default.
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
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

const DEFAULT_PORT = 52342
const CHANNEL_PORT =
  Number.parseInt(process.env.BRAINSTORM_CHANNEL_PORT ?? "", 10) || DEFAULT_PORT

const server = new Server(
  { name: "digital-griot-mcp", version: "1.0.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "Shared Digital Griot wake channel + tool server. Receives wake events from Griot " +
      "browser viewers (prism-brainstorm, prism-gavel). Each notification's `session_id` " +
      "meta key identifies which session generated the click; the `skill` meta key (when " +
      "present, e.g. `gavel`) identifies which surface fired it. The `content` field is a " +
      "human-readable summary. When you receive a wake event, read the events file for that " +
      "session and resume: a brainstorm event → resume the brainstorm session; a gavel event " +
      "(skill=gavel) → run the requested gavel `verb`. This server also exposes the gavel_* " +
      "MCP tools for driving the Gavel cockpit directly, and `prism_viz_engine` — the " +
      "renderer. When a diagram is asked for, CALL prism_viz_engine rather than writing ASCII, " +
      "a mermaid fence, a markdown table of boxes, or a prose description of a picture. Those " +
      "are not diagrams. The engine draws into the brainstorm surface on this same channel.",
  },
)

// ---------------------------------------------------------------------------
// Gavel MCP tools (S2c). Real tool DEFINITIONS on the shared digital-griot-mcp
// server; the deep read/write handler bodies land in S4. The six tools mirror
// the Gavel cockpit's ITEMS/RESOLVE data model (decision store).
// ---------------------------------------------------------------------------

const GAVEL_TOOLS = [
  {
    name: "gavel_state",
    description:
      "Read the Gavel decision store: return undecided cards (or all) plus counts by axis. " +
      "Sources ITEMS/RESOLVE from griot-live-artifacts. Use before a decide/commit pass to " +
      "see what is still undecided.",
    inputSchema: {
      type: "object",
      properties: {
        axis: {
          type: "string",
          description:
            "Optional axis/group to scope the read to (matches the cockpit's AXES/keyOf grouping).",
        },
        filter: {
          type: "string",
          enum: ["undecided", "all"],
          description: "Which cards to return. Default: undecided.",
          default: "undecided",
        },
        state_dir: {
          type: "string",
          description:
            "Optional explicit gavel STATE_DIR to write gavel-cards.json into (matches the " +
            "popout's $GAVEL_DIR/state). If omitted, resolved from env or the newest session " +
            "under <project>/.prism/local/gavel/*/state.",
        },
        project_dir: {
          type: "string",
          description:
            "Optional project root used to locate the newest gavel session STATE_DIR when " +
            "state_dir is not given.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "gavel_decide",
    description:
      "Record a decision on one card in the local cockpit state (use / role / stage / note). " +
      "Does NOT commit to griot-live-artifacts — batch decisions, then gavel_commit writes them.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "The card/item id being decided." },
        use: {
          type: "string",
          description: "The chosen use for this card (the cockpit's uB/use-button value).",
        },
        role: {
          type: "string",
          enum: ["scaffold", "component", "pattern"],
          description: "The card's role (the cockpit's rB/role-button value).",
        },
        stage: {
          type: "string",
          description: "The lifecycle stage for this card (the cockpit's sB/stage-button value).",
        },
        note: {
          type: "string",
          description: "Freeform note attached to this card (the cockpit's noteMap entry).",
        },
        state_dir: {
          type: "string",
          description: "Optional explicit gavel STATE_DIR (see gavel_state).",
        },
      },
      required: ["card_id"],
      additionalProperties: false,
    },
  },
  {
    name: "gavel_open",
    description:
      "Open a card's repository or ▶video URL in the browser (via Chrome MCP). Resolves the URL " +
      "from the card's repoMeta/VIDT/RESMAP link layer.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "The card/item id to open." },
        state_dir: {
          type: "string",
          description: "Optional explicit gavel STATE_DIR (see gavel_state).",
        },
      },
      required: ["card_id"],
      additionalProperties: false,
    },
  },
  {
    name: "gavel_scan",
    description:
      "Route a card to griot-potluck-search — answer 'does our potluck already solve this?' — " +
      "and surface matching existing repos/tools for the card.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "The card/item id to scan against the potluck." },
        state_dir: {
          type: "string",
          description: "Optional explicit gavel STATE_DIR (see gavel_state).",
        },
      },
      required: ["card_id"],
      additionalProperties: false,
    },
  },
  {
    name: "gavel_commit",
    description:
      "Write a decided batch of cards to the plan via dgs-plan-update (which owns the Rule-2 " +
      "anti-clobber sync gate and the artifact refresh). MUST route through dgs-plan-update — " +
      "never writes griot-live-artifacts directly.",
    inputSchema: {
      type: "object",
      properties: {
        card_ids: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional ids of the decided cards to commit as a batch. If omitted, the batch is " +
            "read from the cockpit's events file (the commit wake writes the full ruling payload there).",
        },
        batch: {
          type: "object",
          description:
            "Optional pre-assembled ruling batch (the cockpit's __gavelPayload() shape). Takes " +
            "precedence over the events file. Resolve-and-return only: gavel_commit assembles + " +
            "returns it for dgs-plan-update; it NEVER writes griot-live-artifacts.",
          additionalProperties: true,
        },
        state_dir: {
          type: "string",
          description: "Optional explicit gavel STATE_DIR (see gavel_state).",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "gavel_verify",
    description:
      "Verify/resolve a card: resolve its slug + stars and promote its RESOLVE status " +
      "(v = verified, u = unresolved, x = rejected).",
    inputSchema: {
      type: "object",
      properties: {
        card_id: { type: "string", description: "The card/item id to verify." },
        slug: {
          type: "string",
          description: "Optional explicit repo slug to resolve against (owner/name).",
        },
        state_dir: {
          type: "string",
          description: "Optional explicit gavel STATE_DIR (see gavel_state).",
        },
      },
      required: ["card_id"],
      additionalProperties: false,
    },
  },
  {
    // ── griot_assert — the Griot assertion facade (Q4/Option B) ──────────────
    // ONE verb, TWO phases. Called without `result` it RESOLVES: picks a rung by
    // mechanical capability detection and returns the action to perform. Called
    // WITH `result` it RECORDS: writes the verdict through to plain files.
    // A facade, never a proxy — MCP servers are siblings and cannot call each
    // other, so this uses the same resolve-and-return contract as gavel_open.
    name: "griot_assert",
    description:
      "Assert something about a RUNNING application and record the verdict. Phase 1 (no `result`): " +
      "returns which backend rung to use and the exact action to run. Phase 2 (with `result`): " +
      "writes the verdict through to disk so it survives the session. Never fakes a pass — when no " +
      "rung can execute, the verdict is 'unverified'.",
    inputSchema: {
      type: "object",
      properties: {
        claim: {
          type: "string",
          description: "What is being asserted, in plain language. e.g. 'the header is frosted glass'.",
        },
        expression: {
          type: "string",
          description:
            "JS expression to evaluate in the page for the mcp rung, e.g. " +
            "getComputedStyle(document.querySelector('.top')).backdropFilter",
        },
        expect: {
          description: "Expected value. Omit for an observation with no pass/fail.",
        },
        target: { type: "string", description: "URL or context the assertion runs against." },
        result: {
          type: "object",
          description:
            "PHASE 2 — the observed outcome. Supply { actual, passed } to record the verdict.",
          properties: {
            actual: { description: "The observed value." },
            passed: { type: "boolean", description: "Whether the assertion held." },
            rung: { type: "string", description: "Which rung actually executed." },
          },
          additionalProperties: true,
        },
        state_dir: {
          type: "string",
          description: "Optional explicit STATE_DIR override for where evidence is written.",
        },
      },
      required: ["claim"],
      additionalProperties: false,
    },
  },
  {
    name: "prism_viz_engine",
    description:
      "prism-viz-engine — render a diagram as a real screen instead of describing one. " +
      "`render` emits a self-contained canvas into the live brainstorm session's content dir, " +
      "where the companion serves it immediately (same :52342 channel this server runs on), and " +
      "returns the URL. `layers` returns the eleven Griot Stack layer roles — the output taxonomy " +
      "every placed node is routed to. `validate` checks a JSON Canvas against the wire format. " +
      "Use this INSTEAD OF hand-writing HTML, an ASCII diagram, a mermaid fence, or a markdown " +
      "table of boxes: those are not diagrams. Never invents a node — it renders harvested data " +
      "or refuses.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["render", "layers", "validate"],
          description: "What to do. Default: render.",
          default: "render",
        },
        canvas_path: {
          type: "string",
          description:
            "Path to a JSON Canvas / harvested-nodes file to draw. Omit with mode=render to use " +
            "the engine's own harvested document (--self).",
        },
        title: {
          type: "string",
          description: "Screen title. Defaults to the canvas filename, or 'Harvested components'.",
        },
        content_dir: {
          type: "string",
          description:
            "Explicit brainstorm content dir to write the screen into. If omitted, resolved from " +
            "BRAINSTORM_DIR or the newest session under <project>/.prism/local/brainstorm/*/content.",
        },
        project_dir: {
          type: "string",
          description: "Project root used to locate the newest brainstorm session and the engine.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
] as const

// ===========================================================================
// S4 — gavel tool handler bodies.
//
// Capability split (see .prism/shared/designs/prism-gavel-S2-S5-spec.md §S4):
//   • gavel_state  — fully SERVER-SIDE. Reads the live plan at git HEAD (READ-ONLY),
//                    parses ITEMS/RESOLVE, writes the undecided-cards JSON into the
//                    gavel popout's STATE_DIR (NEVER into griot-live-artifacts).
//   • gavel_verify — SERVER-SIDE where possible. Resolves a card's slug + GitHub stars
//                    over HTTP and RETURNS the v/u/x verdict. Does NOT write it back.
//   • gavel_open / gavel_scan / gavel_commit — "resolve-and-return". They assemble the
//                    actionable payload (URL / scan query+context / decided batch) and
//                    RETURN it; the external action (Chrome MCP, griot-potluck-search,
//                    dgs-plan-update) is performed by Claude on wake. See SKILL.md.
//   • gavel_decide — records a ruling into the STATE_DIR card store (local, no wake).
//
// HARD SAFETY: no handler here ever writes to griot-live-artifacts. The only writes are
// into the gavel STATE_DIR (gavel-cards.json / decisions). gavel_commit is dry-run only.
// ===========================================================================

// Live plan store (Gavin's LIVE artifacts repo). Overridable for tests; default is the
// canonical local path. We only ever `git show HEAD:` it — read-only, never a working write.
const GRIOT_ARTIFACTS_REPO =
  process.env.GRIOT_LIVE_ARTIFACTS ?? "c:/Users/digit/GriotMeta/griot-live-artifacts"
const ARTIFACT_REL = "live/dgs-definitive-plan.html"

// AXES ids + keyOf field mapping are HAND-SYNCED with the cockpit (frame.html):
//   AXES   (frame.html:1376): [['project',…],['vertical',…],['decision',…],['stage',…],['type',…]]
//   keyOf  (frame.html:1378): project→appName · vertical→vertName(vert) · type→kind('oss')
//                              · decision→useOf(=ossDecision) · stage→ossStage
// Do not free-text these — they must match frame.html or the counts drift from the cockpit.
const GAVEL_AXES = ["project", "vertical", "decision", "stage", "type"] as const

type GavelCard = Record<string, unknown> & {
  _id?: string
  type?: string
  app?: string
  oss?: string
  item?: string
  src?: string
  slug?: string
  decision?: string
  role?: string
  stage?: string
  detail?: string
}
type ResolveRow = { n: string; r?: string; s?: string; st?: number }
type AppRow = { id: string; name?: string; vertical?: string }

function readArtifactAtHead(): string {
  // READ-ONLY: `git show HEAD:<path>` streams the committed blob; it never touches the
  // working tree or index of griot-live-artifacts.
  return execFileSync("git", ["-C", GRIOT_ARTIFACTS_REPO, "show", `HEAD:${ARTIFACT_REL}`], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  })
}

function artifactHeadSha(): string {
  try {
    return execFileSync("git", ["-C", GRIOT_ARTIFACTS_REPO, "rev-parse", "--short", "HEAD"], {
      encoding: "utf-8",
    }).trim()
  } catch {
    return "unknown"
  }
}

// Extract a top-level `const <name> = [ … ]` array literal from the artifact HTML using a
// string-aware balanced-bracket scan (object literals inside use unquoted keys / single
// quotes / em-dashes, so JSON.parse can't be used — we isolate the literal then eval it).
function extractArrayLiteral(src: string, name: string): string | null {
  const startRe = new RegExp("const\\s+" + name + "\\s*=\\s*\\[")
  const m = startRe.exec(src)
  if (!m) return null
  const open = m.index + m[0].length - 1 // index of '['
  let depth = 0
  let str: string | null = null
  let esc = false
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (str) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === str) str = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      str = ch
      continue
    }
    if (ch === "[") depth++
    else if (ch === "]") {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  return null
}

function evalArrayLiteral<T = unknown>(literal: string | null): T[] {
  if (!literal) return []
  // Trusted source: Gavin's own committed artifact at git HEAD. The literal is pure data
  // (array of object literals, no calls). Function-constructor eval in this Bun process.
  // eslint-disable-next-line no-new-func
  const fn = new Function("return (" + literal + ")")
  const out = fn()
  return Array.isArray(out) ? (out as T[]) : []
}

type ParsedArtifact = {
  items: GavelCard[]
  resolve: ResolveRow[]
  apps: AppRow[]
  verts: Array<{ id: string; n: string }>
}

function parseArtifact(html: string): ParsedArtifact {
  const items = evalArrayLiteral<GavelCard>(extractArrayLiteral(html, "ITEMS"))
  const resolve = evalArrayLiteral<ResolveRow>(extractArrayLiteral(html, "RESOLVE"))
  const apps = evalArrayLiteral<AppRow>(extractArrayLiteral(html, "APPS"))
  const verts = evalArrayLiteral<{ id: string; n: string }>(extractArrayLiteral(html, "VERTS"))
  // Assign the SAME _id the cockpit assigns (frame.html:1095): 'oss'+<index-in-ITEMS>.
  // Stable across the undecided/all filter so open/scan/verify resolve the same card the
  // cockpit shows.
  items.forEach((it, i) => {
    if (it.type === "oss-inspo") it._id = "oss" + i
  })
  return { items, resolve, apps, verts }
}

// STATE_DIR resolution. Precedence: explicit arg → env → newest gavel session → fallback.
// The gavel popout writes its session under <project>/.prism/local/gavel/<id>/state
// (start-server.sh); this mirror lets a headless tool call find the same dir.
function resolveStateDir(args: Record<string, unknown> | undefined): string {
  const a = args ?? {}
  if (typeof a.state_dir === "string" && a.state_dir) return a.state_dir
  if (process.env.GAVEL_STATE_DIR) return process.env.GAVEL_STATE_DIR
  if (process.env.GAVEL_DIR) return path.join(process.env.GAVEL_DIR, "state")
  const projectDir =
    (typeof a.project_dir === "string" && a.project_dir) ||
    process.env.PRISM_PROJECT_DIR ||
    process.cwd()
  const base = path.join(projectDir, ".prism", "local", "gavel")
  if (fs.existsSync(base)) {
    const sessions = fs
      .readdirSync(base)
      .map((d) => path.join(base, d, "state"))
      .filter((p) => fs.existsSync(p))
      .map((p) => ({ p, m: fs.statSync(p).mtimeMs }))
      .sort((x, y) => y.m - x.m)
    if (sessions.length) return sessions[0].p
  }
  return path.join(base, "_mcp", "state")
}

const GAVEL_CARDS_FILE = "gavel-cards.json"

// Load the card set the cockpit is actually showing. Prefer STATE_DIR/gavel-cards.json
// (written by gavel_state — keeps _ids identical to the cockpit); fall back to a fresh
// read of the artifact at HEAD.
function loadGavelCards(args: Record<string, unknown> | undefined): {
  cards: GavelCard[]
  resolve: ResolveRow[]
  stateDir: string
  from: "state" | "artifact"
  head: string
} {
  const stateDir = resolveStateDir(args)
  const f = path.join(stateDir, GAVEL_CARDS_FILE)
  if (fs.existsSync(f)) {
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf-8"))
      if (Array.isArray(j.cards)) {
        return {
          cards: j.cards as GavelCard[],
          resolve: (j.resolve as ResolveRow[]) ?? [],
          stateDir,
          from: "state",
          head: typeof j.head === "string" ? j.head : "unknown",
        }
      }
    } catch {
      /* fall through to artifact */
    }
  }
  const { items, resolve } = parseArtifact(readArtifactAtHead())
  return {
    cards: items.filter((it) => it.type === "oss-inspo"),
    resolve,
    stateDir,
    from: "artifact",
    head: artifactHeadSha(),
  }
}

function findCard(cards: GavelCard[], id: string): GavelCard | null {
  return cards.find((c) => c._id === id) ?? null
}

// Repo-link resolver — a faithful port of the cockpit's repoMeta/_clRepo/_site (frame.html
// :1389-1400) so gavel_open/gavel_verify resolve the SAME URL/tier the cockpit renders.
const _clRepo = (s: unknown): s is string =>
  typeof s === "string" &&
  s.indexOf("/") > 0 &&
  s.indexOf("not OSS") < 0 &&
  s.charAt(0) !== "—" &&
  s.indexOf("http") !== 0 &&
  s.indexOf(" ") < 0
const _site = (s: unknown): s is string =>
  typeof s === "string" &&
  s.indexOf("/") < 0 &&
  s.indexOf(".") > 0 &&
  s.indexOf(" ") < 0 &&
  s.indexOf("not OSS") < 0 &&
  s.charAt(0) !== "—"

function resmapOf(resolve: ResolveRow[]): Record<string, ResolveRow> {
  return Object.fromEntries(resolve.map((o) => [o.n, o]))
}

function repoMeta(card: GavelCard, resmap: Record<string, ResolveRow>) {
  const name = (card.oss as string) || (card.item as string) || ""
  const src = (card.src as string) || ""
  const R = resmap[name]
  const vid = src.indexOf("potluck:") === 0 ? src.slice(8) : ""
  let url = "",
    label = "",
    tier: "v" | "u" | "x" = "x",
    star = 0,
    ext = false
  if (_clRepo(card.slug)) {
    url = "https://github.com/" + card.slug
    label = card.slug
    tier = R && R.s === "v" ? "v" : "u"
    star = (R && R.st) || 0
  } else if (R && _clRepo(R.r)) {
    url = "https://github.com/" + R.r
    label = R.r as string
    tier = R.s === "v" ? "v" : "u"
    star = R.st || 0
  } else if (_site(card.slug)) {
    url = "https://" + card.slug
    label = card.slug
    tier = "u"
    ext = true
  } else {
    url = "https://github.com/search?q=" + encodeURIComponent(name) + "&type=repositories"
    label = 'search "' + name + '"'
    tier = "x"
  }
  return { url, label, tier, star, vid, ext }
}

const okJson = (obj: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
})

// --- gavel_state (SERVER-SIDE read + STATE_DIR write) ---
function handleGavelState(args: Record<string, unknown>) {
  const filter = args.filter === "all" ? "all" : "undecided"
  const html = readArtifactAtHead()
  const { items, resolve, apps, verts } = parseArtifact(html)
  const appById: Record<string, AppRow> = Object.fromEntries(apps.map((a) => [a.id, a]))
  const vertName = (v: string) => verts.find((z) => z.id === v)?.n ?? v

  const ossInspo = items.filter((it) => it.type === "oss-inspo")
  const cards =
    filter === "all"
      ? ossInspo
      : ossInspo.filter((it) => ((it.decision as string) || "undecided") === "undecided")

  // Faithful keyOf mirror (frame.html:1378) for the summary counts.
  const keyOf = (card: GavelCard, axis: string): string => {
    const app = appById[card.app as string]
    const appName = app ? app.name ?? (card.app as string) : (card.app as string) || "Suite-wide"
    const vert = app ? app.vertical ?? "assistant" : "assistant"
    switch (axis) {
      case "project":
        return appName as string
      case "vertical":
        return vertName(vert as string)
      case "type":
        return "oss"
      case "decision":
        return (card.decision as string) || "undecided"
      case "stage":
        return (card.stage as string) || "later"
      default:
        return "?"
    }
  }
  const counts: Record<string, Record<string, number>> = {}
  for (const ax of GAVEL_AXES) {
    const c: Record<string, number> = {}
    for (const card of cards) {
      const k = keyOf(card, ax)
      c[k] = (c[k] || 0) + 1
    }
    counts[ax] = c
  }

  const stateDir = resolveStateDir(args)
  const head = artifactHeadSha()
  const payload = {
    ok: true,
    tool: "gavel_state",
    source: ARTIFACT_REL,
    repo: GRIOT_ARTIFACTS_REPO,
    head,
    read_only: true,
    filter,
    axis: typeof args.axis === "string" ? args.axis : null,
    axes: GAVEL_AXES,
    generated_at: new Date().toISOString(),
    count: cards.length,
    counts,
    cards,
    resolve,
  }

  fs.mkdirSync(stateDir, { recursive: true })
  const outFile = path.join(stateDir, GAVEL_CARDS_FILE)
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2))

  return okJson({ ...payload, state_dir: stateDir, written: outFile })
}

// --- gavel_open (resolve-and-return: URL for Chrome MCP) ---
function handleGavelOpen(args: Record<string, unknown>) {
  const cardId = String(args.card_id ?? "")
  const { cards, resolve, from, head } = loadGavelCards(args)
  const card = findCard(cards, cardId)
  if (!card) {
    return okJson({ ok: false, tool: "gavel_open", card_id: cardId, error: "card not found", from })
  }
  const m = repoMeta(card, resmapOf(resolve))
  return okJson({
    ok: true,
    tool: "gavel_open",
    action: "open_in_chrome",
    card_id: cardId,
    title: card.oss ?? card.item ?? "",
    url: m.url,
    label: m.label,
    tier: m.tier,
    stars: m.star || null,
    external: m.ext,
    video_url: m.vid ? "https://youtu.be/" + m.vid : null,
    from,
    head,
    instruction:
      "On wake, Claude opens `url` (and optionally `video_url`) via the Chrome MCP — the " +
      "sandbox-safe path. The tool does not open anything itself.",
  })
}

// --- gavel_scan (resolve-and-return: query+context for griot-potluck-search) ---
function handleGavelScan(args: Record<string, unknown>) {
  const cardId = String(args.card_id ?? "")
  const { cards, from, head } = loadGavelCards(args)
  const card = findCard(cards, cardId)
  if (!card) {
    return okJson({ ok: false, tool: "gavel_scan", card_id: cardId, error: "card not found", from })
  }
  const name = (card.oss as string) || (card.item as string) || ""
  return okJson({
    ok: true,
    tool: "gavel_scan",
    action: "run_potluck_search",
    skill: "griot-potluck-search",
    card_id: cardId,
    query: name,
    context: {
      question: "Does our Griot Potluck already solve this?",
      tool: name,
      app: card.app ?? null,
      detail: card.detail ?? "",
      slug: card.slug ?? "",
    },
    from,
    head,
    instruction:
      "On wake, Claude runs the griot-potluck-search skill with `query`/`context` to check " +
      "whether an existing potluck repo already covers this card.",
  })
}

// --- gavel_verify (SERVER-SIDE: slug + GitHub stars → v/u/x verdict; NO write-back) ---
async function handleGavelVerify(args: Record<string, unknown>) {
  const cardId = String(args.card_id ?? "")
  const { cards, resolve, from, head } = loadGavelCards(args)
  const card = findCard(cards, cardId)
  const resmap = resmapOf(resolve)
  const previous = card ? repoMeta(card, resmap).tier : "x"
  let slug =
    (typeof args.slug === "string" && args.slug) ||
    (card && (card.slug as string)) ||
    (card && resmap[(card.oss as string) || (card.item as string)]?.r) ||
    ""

  const base = {
    ok: true as const,
    tool: "gavel_verify" as const,
    action: "promote_resolve" as const,
    write: false as const,
    card_id: cardId,
    slug,
    previous,
    from,
    head,
    note:
      "Verdict only — gavel_verify RETURNS v/u/x and NEVER writes it back to " +
      "griot-live-artifacts. The write happens on commit, through dgs-plan-update.",
  }

  if (!_clRepo(slug)) {
    return okJson({ ...base, stars: null, verdict: "u", reason: "no resolvable owner/name slug" })
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "prism-gavel",
    }
    if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN
    const res = await fetch("https://api.github.com/repos/" + slug, { headers })
    if (res.status === 200) {
      const j = (await res.json()) as { stargazers_count?: number }
      return okJson({ ...base, stars: j.stargazers_count ?? 0, verdict: "v" })
    }
    if (res.status === 404) {
      return okJson({ ...base, stars: null, verdict: "x", reason: "repo not found (404)" })
    }
    return okJson({ ...base, stars: null, verdict: "u", reason: "github status " + res.status })
  } catch (err) {
    return okJson({ ...base, stars: null, verdict: "u", reason: "fetch failed: " + String(err) })
  }
}

// --- gavel_commit (resolve-and-return: assemble batch → route to dgs-plan-update; DRY-RUN) ---
function handleGavelCommit(args: Record<string, unknown>) {
  const stateDir = resolveStateDir(args)
  let batch: unknown = args.batch ?? null
  let source: "arg" | "events_file" | "none" = args.batch ? "arg" : "none"

  if (!batch) {
    const eventsFile = path.join(stateDir, "events")
    if (fs.existsSync(eventsFile)) {
      const lines = fs.readFileSync(eventsFile, "utf-8").trim().split("\n").filter(Boolean)
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const e = JSON.parse(lines[i])
          if (e.verb === "commit" && e.batch) {
            batch = e.batch
            source = "events_file"
            break
          }
        } catch {
          /* skip malformed line */
        }
      }
    }
  }

  const cardIds = Array.isArray(args.card_ids) ? (args.card_ids as string[]) : null
  return okJson({
    ok: true,
    tool: "gavel_commit",
    action: "run_dgs_plan_update",
    route: "dgs-plan-update",
    dry_run: true,
    hitl_required: true,
    state_dir: stateDir,
    source,
    card_ids: cardIds,
    batch: batch ?? null,
    note:
      "DRY-RUN / resolve-and-return only. On wake, Claude runs the dgs-plan-update skill " +
      "with `batch`. dgs-plan-update owns the Rule-2 anti-clobber sync gate (stage-live vs " +
      "repo HEAD; diverge → STOP + reconcile) and the artifact refresh. gavel_commit NEVER " +
      "writes griot-live-artifacts directly.",
  })
}

// --- gavel_decide (local STATE_DIR ruling; no wake, no artifact write) ---
function handleGavelDecide(args: Record<string, unknown>) {
  const cardId = String(args.card_id ?? "")
  const stateDir = resolveStateDir(args)
  const f = path.join(stateDir, GAVEL_CARDS_FILE)
  if (!fs.existsSync(f)) {
    return okJson({
      ok: false,
      tool: "gavel_decide",
      card_id: cardId,
      error: "no gavel-cards.json in STATE_DIR — run gavel_state first",
      state_dir: stateDir,
    })
  }
  let store: { cards?: GavelCard[] }
  try {
    store = JSON.parse(fs.readFileSync(f, "utf-8"))
  } catch (err) {
    return okJson({ ok: false, tool: "gavel_decide", error: "corrupt store: " + String(err) })
  }
  const card = (store.cards ?? []).find((c) => c._id === cardId)
  if (!card) {
    return okJson({ ok: false, tool: "gavel_decide", card_id: cardId, error: "card not found" })
  }
  if (typeof args.use === "string") card.decision = args.use
  if (typeof args.role === "string") card.role = args.role
  if (typeof args.stage === "string") card.stage = args.stage
  if (typeof args.note === "string") (card as Record<string, unknown>).note = args.note
  fs.writeFileSync(f, JSON.stringify(store, null, 2))
  return okJson({
    ok: true,
    tool: "gavel_decide",
    card_id: cardId,
    card,
    state_dir: stateDir,
    note: "Local ruling written to STATE_DIR only. No wake; griot-live-artifacts untouched.",
  })
}

function errJson(text: string) {
  return { isError: true, content: [{ type: "text" as const, text }] }
}

// ===========================================================================
// griot_assert — the assertion facade.
//
// Contract: .prism/shared/plans/2026-09-04-assert-facade-CONTEXT.md
//
// Two invariants keep this infrastructure glass-box rather than opaque:
//   1. WRITE-THROUGH — a recorded verdict lands as a plain file. Kill the
//      server and the evidence survives. An assertion that exists only in a
//      tool response is treated as not having happened.
//   2. MECHANICAL LADDER — resolveAssertRung() reads environment FACTS only
//      (env vars, file existence). It never branches on model judgment; that
//      is the line between a facade and a framework.
// ===========================================================================

type AssertRung = "mcp" | "bridge" | "cli" | "none"

/** Capability detection ONLY — env vars and file existence. No judgment. */
function resolveAssertRung(): { rung: AssertRung; why: string } {
  const forced = String(process.env.GRIOT_ASSERT_RUNG ?? "").trim()
  if (forced === "mcp" || forced === "bridge" || forced === "cli" || forced === "none") {
    return { rung: forced, why: "GRIOT_ASSERT_RUNG override" }
  }
  if (process.env.GRIOT_DEVICE_BRIDGE) {
    return { rung: "bridge", why: "GRIOT_DEVICE_BRIDGE present — dispatch device-side" }
  }
  // chrome-devtools is declared per-project in .mcp.json; its presence there is
  // a mechanical fact we can read off disk.
  for (const root of [process.env.CLAUDE_PROJECT_DIR, process.cwd()]) {
    if (!root) continue
    try {
      const cfg = path.join(root, ".mcp.json")
      if (fs.existsSync(cfg) && fs.readFileSync(cfg, "utf-8").includes("chrome-devtools")) {
        return { rung: "mcp", why: ".mcp.json declares chrome-devtools" }
      }
    } catch {
      /* unreadable config is simply not evidence */
    }
  }
  if (process.env.SHELL || process.env.ComSpec) {
    return { rung: "cli", why: "a shell exists but no browser MCP was found" }
  }
  return { rung: "none", why: "no execution path available" }
}

/** Where evidence lands. Explicit arg → env → project .prism/local → cwd. */
function assertEvidenceDir(args: Record<string, unknown>): string {
  const explicit = String(args.state_dir ?? "").trim()
  if (explicit) return explicit
  if (process.env.GRIOT_ASSERT_DIR) return process.env.GRIOT_ASSERT_DIR
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  return path.join(root, ".prism", "local", "assertions")
}

function handleGriotAssert(args: Record<string, unknown>) {
  const claim = String(args.claim ?? "").trim()
  if (!claim) return okJson({ ok: false, tool: "griot_assert", error: "claim is required" })

  const expression = String(args.expression ?? "").trim()
  const target = String(args.target ?? "").trim()
  const hasExpect = Object.prototype.hasOwnProperty.call(args, "expect")
  const result = args.result as Record<string, unknown> | undefined

  // ── PHASE 1 · RESOLVE ────────────────────────────────────────────────────
  if (!result) {
    const { rung, why } = resolveAssertRung()
    const action =
      rung === "mcp"
        ? "run_evaluate_script"
        : rung === "bridge"
          ? "dispatch_device_side"
          : rung === "cli"
            ? "run_cli_equivalent"
            : "record_unverified"
    return okJson({
      ok: true,
      tool: "griot_assert",
      phase: "resolve",
      rung,
      why,
      action,
      claim,
      target: target || null,
      expression: expression || null,
      expect: hasExpect ? args.expect : null,
      instruction:
        rung === "mcp"
          ? "Evaluate `expression` in the page via chrome-devtools evaluate_script, then call " +
            "griot_assert again with result={actual,passed,rung:'mcp'} to record the verdict."
          : rung === "bridge"
            ? "Dispatch the evaluation device-side over the passive file bus, then call griot_assert " +
              "again with result={actual,passed,rung:'bridge'}."
            : rung === "cli"
              ? "Run the CLI equivalent, then call griot_assert again with result={actual,passed,rung:'cli'}."
              : "No rung can execute. Call griot_assert again with result={passed:false,rung:'none'} " +
                "to record this as UNVERIFIED. Do not report a pass.",
    })
  }

  // ── PHASE 2 · RECORD (write-through) ─────────────────────────────────────
  const rung = String(result.rung ?? resolveAssertRung().rung)
  const verdict = rung === "none" ? "unverified" : result.passed === true ? "pass" : "fail"
  const when = new Date().toISOString()
  const record = {
    when,
    claim,
    target: target || null,
    expression: expression || null,
    expect: hasExpect ? args.expect : null,
    actual: result.actual ?? null,
    rung,
    verdict,
  }

  const dir = assertEvidenceDir(args)
  let written: string[] = []
  try {
    fs.mkdirSync(dir, { recursive: true })
    const jsonl = path.join(dir, "assertions.jsonl")
    fs.appendFileSync(jsonl, JSON.stringify(record) + "\n", "utf-8")
    written.push(jsonl)

    // a human-readable twin — the point of write-through is that you can read it
    // with no tooling at all
    const md = path.join(dir, "assertions.md")
    if (!fs.existsSync(md)) {
      fs.writeFileSync(md, "# Assertions\n\n| when | verdict | rung | claim | actual |\n|---|---|---|---|---|\n", "utf-8")
    }
    const cell = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 120)
    fs.appendFileSync(
      md,
      `| ${when} | **${verdict}** | ${cell(rung)} | ${cell(claim)} | ${cell(record.actual)} |\n`,
      "utf-8",
    )
    written.push(md)
  } catch (err) {
    return okJson({
      ok: false,
      tool: "griot_assert",
      phase: "record",
      error: `write-through failed: ${String(err)}`,
      record,
    })
  }

  return okJson({ ok: true, tool: "griot_assert", phase: "record", verdict, record, written })
}

// ===========================================================================
// prism_viz_engine — the engine, reachable as a tool call.
//
// Gavin's rule, made mechanical: "when I ask for a diagram I mean a RENDERED
// VISUAL." An agent that can only describe a picture will describe one. This
// hands it a renderer instead, wired to the surface he is already looking at.
//
// Capability split, same shape as the gavel tools:
//   • render   — SERVER-SIDE. Shells out to the engine's own emit-screen.mjs
//                (one home per fact — the renderer is never reimplemented here)
//                and writes into the live brainstorm content dir, which
//                server.cjs watches. Returns the served URL.
//   • layers   — reads LAYER_ROLES from the engine source. Never retyped by
//                hand: the emitter, the canvas and the plan key on exact
//                string equality, middle dots included.
//   • validate — parses a canvas and reports node/edge/layer coverage,
//                including which of the eleven layers are UNFILLED. An
//                unfilled layer is reported, never invented.
// ===========================================================================

/** Resolve the engine's own root so the tool works from any cwd. */
function resolveEngineDir(args: Record<string, unknown>): string {
  const projectDir =
    (typeof args.project_dir === "string" && args.project_dir) ||
    process.env.PRISM_PROJECT_DIR ||
    process.cwd()
  return path.join(projectDir, "apps", "prism-viz-engine")
}

/**
 * CONTENT_DIR resolution. Precedence: explicit arg → BRAINSTORM_DIR env →
 * newest brainstorm session → null. Mirrors resolveStateDir's contract, against
 * server.cjs:80's `<BRAINSTORM_DIR>/content`.
 */
function resolveBrainstormContentDir(args: Record<string, unknown>): string | null {
  if (typeof args.content_dir === "string" && args.content_dir) return args.content_dir
  if (process.env.BRAINSTORM_DIR) return path.join(process.env.BRAINSTORM_DIR, "content")
  const projectDir =
    (typeof args.project_dir === "string" && args.project_dir) ||
    process.env.PRISM_PROJECT_DIR ||
    process.cwd()
  const base = path.join(projectDir, ".prism", "local", "brainstorm")
  if (!fs.existsSync(base)) return null
  const sessions = fs
    .readdirSync(base)
    .map((d) => path.join(base, d, "content"))
    .filter((p) => fs.existsSync(p))
    .map((p) => ({ p, m: fs.statSync(p).mtimeMs }))
    .sort((x, y) => y.m - x.m)
  return sessions.length ? sessions[0].p : null
}

/** The served URL for a session, read from the server's own started-log. */
function brainstormUrlFor(contentDir: string): string | null {
  try {
    const log = path.join(path.dirname(contentDir), "state", "server.log")
    if (!fs.existsSync(log)) return null
    const line = fs
      .readFileSync(log, "utf-8")
      .split("\n")
      .find((l) => l.includes("server-started"))
    if (!line) return null
    const url = JSON.parse(line).url
    return typeof url === "string" ? url : null
  } catch {
    return null
  }
}

/** LAYER_ROLES, read from the engine source rather than duplicated here. */
function readLayerRoles(engineDir: string): string[] {
  const src = path.join(engineDir, "src", "core", "layer-roles.ts")
  if (!fs.existsSync(src)) return []
  const lit = extractArrayLiteral(fs.readFileSync(src, "utf-8"), "LAYER_ROLES")
  if (!lit) return []
  return [...lit.matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

function handlePrismVizEngine(args: Record<string, unknown>) {
  const mode = typeof args.mode === "string" ? args.mode : "render"
  const engineDir = resolveEngineDir(args)

  if (!fs.existsSync(engineDir)) {
    return okJson({
      ok: false,
      tool: "prism_viz_engine",
      error: `engine not found at ${engineDir}. Pass project_dir, or set PRISM_PROJECT_DIR.`,
    })
  }

  const roles = readLayerRoles(engineDir)

  if (mode === "layers") {
    return okJson({
      ok: roles.length > 0,
      tool: "prism_viz_engine",
      mode: "layers",
      count: roles.length,
      layer_roles: roles,
      unplaceable: "unplaceable",
      note:
        "ELEVEN, not nine. A finding that fits no role is flagged `unplaceable` — never " +
        "force-fit into a twelfth, and never invented to fill an empty layer.",
      source: path.join(engineDir, "src", "core", "layer-roles.ts"),
    })
  }

  if (mode === "validate") {
    const p = typeof args.canvas_path === "string" ? args.canvas_path : ""
    if (!p || !fs.existsSync(p)) {
      return okJson({
        ok: false,
        tool: "prism_viz_engine",
        mode: "validate",
        error: `canvas_path required and must exist. Got: ${p || "(none)"}`,
      })
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(p, "utf-8"))
    } catch (err) {
      return okJson({ ok: false, tool: "prism_viz_engine", mode: "validate", error: String(err) })
    }
    const nodes = Array.isArray(parsed)
      ? (parsed as Record<string, unknown>[])
      : ((parsed as { nodes?: Record<string, unknown>[] }).nodes ?? [])
    const used = new Set<string>()
    let withOrigin = 0
    for (const n of nodes) {
      const layer =
        (n.layer as string) ?? ((n.griot as { layer?: string } | undefined)?.layer as string)
      if (layer) used.add(layer)
      const data = n.data as { origin?: { file?: string; line?: number } } | undefined
      if (data?.origin?.file) withOrigin++
    }
    const unfilled = roles.filter((r) => !used.has(r))
    return okJson({
      ok: true,
      tool: "prism_viz_engine",
      mode: "validate",
      canvas_path: p,
      nodes: nodes.length,
      with_file_line_origin: `${withOrigin}/${nodes.length}`,
      layers_filled: `${used.size}/${roles.length}`,
      unfilled_layers: unfilled,
      note:
        unfilled.length > 0
          ? "Unfilled layers are reported as unfilled. Never invent a source to fill one."
          : "Every layer role has at least one grounded source.",
    })
  }

  // mode === "render"
  const script = path.join(engineDir, "scripts", "emit-screen.mjs")
  if (!fs.existsSync(script)) {
    return okJson({ ok: false, tool: "prism_viz_engine", error: `emit-screen.mjs not found at ${script}` })
  }
  const contentDir = resolveBrainstormContentDir(args)
  if (!contentDir) {
    return okJson({
      ok: false,
      tool: "prism_viz_engine",
      mode: "render",
      error:
        "No brainstorm content dir found. Start a companion session first (prism-brainstorm " +
        "start-server.sh), or pass content_dir explicitly. Nothing is rendered into thin air.",
    })
  }

  const argv: string[] = [script]
  if (typeof args.canvas_path === "string" && args.canvas_path) {
    argv.push("--in", args.canvas_path)
  } else {
    argv.push("--self")
  }
  if (typeof args.title === "string" && args.title) argv.push("--title", args.title)
  argv.push("--out", contentDir)

  let stdout = ""
  try {
    stdout = execFileSync("node", argv, {
      encoding: "utf-8",
      cwd: engineDir,
      env: { ...process.env, PRISM_ROOT: path.join(engineDir, "..", "..") },
    })
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    return okJson({
      ok: false,
      tool: "prism_viz_engine",
      mode: "render",
      error: (e.stderr || e.stdout || e.message || String(err)).trim(),
      note: "The emitter refuses to draw an empty or ungrounded canvas. That refusal is the feature.",
    })
  }

  const stats = stdout.match(/(\d+) nodes · (\d+) edges · (\d+)\/(\d+) layers/)
  const wrote = stdout.match(/wrote\s+(.+)/)
  const url = brainstormUrlFor(contentDir)

  return okJson({
    ok: true,
    tool: "prism_viz_engine",
    mode: "render",
    nodes: stats ? Number(stats[1]) : null,
    edges: stats ? Number(stats[2]) : null,
    layers_filled: stats ? `${stats[3]}/${stats[4]}` : null,
    screen: wrote ? wrote[1].trim() : null,
    url,
    channel_port: CHANNEL_PORT,
    note:
      "The companion watches this directory and serves the newest screen at the URL above. " +
      "Static render: reveal-to-source needs the sidecar, which is not listening here.",
  })
}

// tools/list — advertise the gavel tools plus the assertion facade.
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: GAVEL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}))

// tools/call — S4 handler bodies (capability split documented above).
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params
  const args = (rawArgs ?? {}) as Record<string, unknown>
  try {
    switch (name) {
      case "gavel_state":
        return handleGavelState(args)
      case "gavel_open":
        return handleGavelOpen(args)
      case "gavel_scan":
        return handleGavelScan(args)
      case "gavel_verify":
        return await handleGavelVerify(args)
      case "gavel_commit":
        return handleGavelCommit(args)
      case "gavel_decide":
        return handleGavelDecide(args)
      case "griot_assert":
        return handleGriotAssert(args)
      case "prism_viz_engine":
        return handlePrismVizEngine(args)
      default:
        return errJson(`Unknown tool: ${name}`)
    }
  } catch (err) {
    return errJson(
      JSON.stringify(
        { ok: false, tool: name, error: String(err instanceof Error ? err.stack : err) },
        null,
        2,
      ),
    )
  }
})

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

// The channel binds a FIXED port (52342) — that port IS the discovery contract
// server.cjs/helper.js depend on, so it must not become dynamic. But this server is
// spawned PER Claude Code session, so concurrent sessions race for the bind. Before the
// retry loop below, every loser logged once to stderr (invisible — MCP stderr is never
// surfaced) and then gave up forever. When the winning session later exited, the port
// freed but no survivor ever reclaimed it: live processes, zero listeners, a dead wake
// channel for both prism-gavel and prism-brainstorm. Losers now stand by and rebind the
// moment the port frees.
const CHANNEL_SERVE_OPTIONS = {
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

    // sanitizeMeta forwards ALL string meta keys unchanged (surface-agnostic relay).
    // brainstorm keys (choice, element_id) and gavel keys (skill, verb, card_id, use,
    // role, stage) are all underscore/alpha, so they pass through as-is — the surface
    // is disambiguated by `meta`, not by any branch here.
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
          content: "Griot viewer interaction — read events file for details",
          meta,
        },
      })
    } catch (err) {
      // Log but don't crash — the notification failing shouldn't break the HTTP response.
      // Common causes: stdio transport not connected yet, Claude Code doesn't support
      // this notification method, or the MCP connection was dropped.
      console.error("[digital-griot-mcp] notification failed:", String(err))
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    })
  },
}

const REBIND_DELAY_MS = 3000
let rebindTimer: ReturnType<typeof setTimeout> | null = null

// Bind, or stand by and keep trying. Never crashes the MCP process — the stdio transport
// (and every gavel_* tool) works regardless of whether the HTTP listener is up.
function bindChannel(): void {
  try {
    httpServer = Bun.serve(CHANNEL_SERVE_OPTIONS as Parameters<typeof Bun.serve>[0])
    if (rebindTimer) {
      clearTimeout(rebindTimer)
      rebindTimer = null
      console.error(
        `[digital-griot-mcp] HTTP channel RECLAIMED 127.0.0.1:${CHANNEL_PORT} — wake active.`,
      )
    } else {
      console.error(`[digital-griot-mcp] HTTP channel listening on 127.0.0.1:${CHANNEL_PORT}`)
    }
  } catch (err) {
    httpServer = null
    if (!rebindTimer) {
      // Log the transition once, not once per retry, so stderr stays readable.
      console.error(
        `[digital-griot-mcp] HTTP bind failed (${String(err)}) — another instance owns ` +
          `:${CHANNEL_PORT}. Standing by; will reclaim it if that instance exits.`,
      )
    }
    rebindTimer = setTimeout(bindChannel, REBIND_DELAY_MS)
    // Don't hold the process open on the retry timer alone.
    ;(rebindTimer as unknown as { unref?: () => void }).unref?.()
  }
}

bindChannel()

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
      content: "digital-griot-mcp: capability probe",
      meta: { type: "probe" },
    },
  })
  // If we reach here, the channel is functional.
} catch {
  passiveMode = true
  console.error(
    "[digital-griot-mcp] claude/channel not available — passive mode active (Claude Code < v2.1.80). " +
    "Events file will still be written; send a message to Claude to read your selections.",
  )
}
