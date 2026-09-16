#!/usr/bin/env node
/**
 * gate-ir.mjs — the deterministic half of prism-viz-generate (layer 01).
 *
 * WHAT THIS DOES NOT DO: validate. archify's own validator is vendored at
 * `apps/prism-viz-engine/vendor/archify/renderers/shared/validator.mjs`, is standalone
 * -compiled with zero runtime dependencies, and already emits repair-shaped diagnostics
 * ("/components/2 (id/label: \"gateway\") must have required property 'label'"). Writing
 * a second validator against the same five schemas would be a second thing to drift.
 * This calls theirs.
 *
 * WHAT IT ADDS is the one rule archify has no opinion about: GROUNDING.
 *
 *   archify's schema defines `component.sources` as {path, line, end_line, label} with
 *   `path` required — a file:line provenance field — and NOT ONE of its own examples
 *   uses it. That field is the never-invent gate, already in the contract, unused.
 *
 * So: a generated diagram must cite where each component came from, the same way the
 * UX/UI harvest demands file:line for every finding. A node nobody can trace is a node
 * somebody made up, and this engine exists because made-up pictures cost more than no
 * picture.
 *
 * It also REPORTS the renderer the diagram will get, by calling archify's own
 * `deploymentOwnershipDiagnostics` rather than re-deriving "is this deployment topology"
 * — so the author sees the routing consequence before the canvas opens.
 *
 * Usage:
 *   node gate-ir.mjs --in <diagram.json> [--out <dir>] [--allow-ungrounded] [--dry-run]
 *
 * Exits nonzero on any violation and writes nothing. Never a partial write.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname, basename, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const PRISM_ROOT = resolve(process.env.PRISM_ROOT ?? join(import.meta.dirname, "..", "..", ".."))
const VENDOR = join(PRISM_ROOT, "apps", "prism-viz-engine", "vendor", "archify")
const DEFAULT_OUT = join(PRISM_ROOT, ".prism", "shared", "workgraph", "diagrams")

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null }

const inPath = opt("--in")
if (!inPath) {
  console.error("Usage: node gate-ir.mjs --in <diagram.json> [--out <dir>] [--allow-ungrounded] [--dry-run]")
  process.exit(1)
}
if (!existsSync(inPath)) {
  console.error(`gate-ir: --in not found: ${inPath}`)
  process.exit(1)
}

let ir
try {
  ir = JSON.parse(readFileSync(inPath, "utf-8"))
} catch (e) {
  console.error(`gate-ir: --in is not valid JSON: ${e.message}`)
  process.exit(1)
}

const type = ir.diagram_type
const KNOWN = ["architecture", "workflow", "sequence", "dataflow", "lifecycle"]
if (!KNOWN.includes(type)) {
  console.error(`gate-ir: diagram_type must be one of ${KNOWN.join(" | ")}, got ${JSON.stringify(type)}`)
  console.error(`  fix: set "diagram_type" — it also picks the renderer (see references/type-selection.md)`)
  process.exit(1)
}

const load = (rel) => import(pathToFileURL(join(VENDOR, rel)).href)

// ── 1. archify's own schema validation ────────────────────────────────────────
let schemaOk = false
try {
  const { validateSchema } = await load("renderers/shared/validator.mjs")
  validateSchema(type, ir)
  schemaOk = true
} catch (e) {
  if (/Cannot find module|ERR_MODULE_NOT_FOUND/.test(e.message)) {
    console.error(`gate-ir: archify is not vendored at ${VENDOR}`)
    console.error(`  fix: this skill validates against the vendored archify schemas — restore apps/prism-viz-engine/vendor/archify`)
    process.exit(1)
  }
  console.error("gate-ir: SCHEMA — archify rejects this diagram.\n")
  console.error(e.message.split("\n").map((l) => "  " + l).join("\n"))
  console.error("\n  Each line above names the path, the offending value, and the allowed set.")
  console.error("  Fix them in the IR and re-run — the diagnostics are the repair instructions.")
  process.exit(1)
}

// ── 2. the grounding gate — OURS, and the reason this script exists ───────────
const components = Array.isArray(ir.components) ? ir.components : []
const needsSource = components.filter((c) => c.type !== "external")
const ungrounded = needsSource.filter(
  (c) => !Array.isArray(c.sources) || c.sources.length === 0 || !c.sources.every((s) => s && typeof s.path === "string" && s.path.trim())
)

if (ungrounded.length && !flag("--allow-ungrounded")) {
  console.error(`gate-ir: GROUNDING — ${ungrounded.length} of ${needsSource.length} component(s) cite no source.\n`)
  for (const c of ungrounded) {
    const i = components.indexOf(c)
    console.error(`  /components/${i} (id: ${JSON.stringify(c.id)}, label: ${JSON.stringify(c.label)})`)
    console.error(`      fix: set /components/${i}/sources to [{"path":"<repo-relative file>","line":<n>}]`)
  }
  console.error(`\n  archify's schema defines this field and requires "path"; it is how a diagram proves`)
  console.error(`  it was read rather than imagined. \`external\` components are exempt — they are`)
  console.error(`  outside the system by definition.`)
  console.error(`\n  If this diagram genuinely has no code to cite (a proposed design, a whiteboard),`)
  console.error(`  pass --allow-ungrounded and say so where it is published.`)
  process.exit(1)
}

// ── 3. report the routing consequence, using archify's own profile ────────────
let route = type === "architecture" ? "node-graph" : "node-graph"
let routeWhy = "ordered structure — the node graph carries it"
if (type === "architecture") {
  try {
    const { deploymentOwnershipDiagnostics } = await load("renderers/shared/engineering-profiles.mjs")
    const d = deploymentOwnershipDiagnostics(ir) ?? []
    const errs = d.filter((x) => x.severity === "error")
    if (errs.length === 0) {
      route = "ISOMETRIC"
      routeWhy = "satisfies archify's deployment-ownership profile — real topology, so it gets a floor plan"
    } else {
      routeWhy = `not deployment topology (${errs.length} deployment-ownership gap(s)) — components and relationships, drawn flat`
    }
  } catch {
    routeWhy = "architecture — routing decided at load by the engine"
  }
}

// ── 4. place it ───────────────────────────────────────────────────────────────
const outDir = opt("--out") ?? DEFAULT_OUT
const name = basename(inPath).replace(/\.json$/i, "")
const outPath = join(outDir, `${name}.json`)

console.log(`gate-ir: ${basename(inPath)}`)
console.log(`  schema      archify ${type} — valid`)
console.log(`  grounding   ${needsSource.length - ungrounded.length}/${needsSource.length} components cite a source${ungrounded.length ? "  (--allow-ungrounded)" : ""}`)
console.log(`  components  ${components.length}   connections ${(ir.connections ?? []).length}   boundaries ${(ir.boundaries ?? []).length}`)
console.log(`  renderer    ${route}`)
console.log(`              ${routeWhy}`)

if (flag("--dry-run")) {
  console.log("  --dry-run, not written.")
  process.exit(0)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(ir, null, 2) + "\n", "utf-8")
console.log(`  wrote       ${outPath}`)
console.log(`\n  The engine picks this up from the sidecar. Nothing else to run.`)
