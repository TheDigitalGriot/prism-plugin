#!/usr/bin/env node
/**
 * emit-canvas-nodes.mjs â€” the mechanical half of a griot-harvest-ux-ui walk.
 *
 * WHY THIS IS A SCRIPT AND NOT PROSE
 * -----------------------------------
 * Validating a node against a fixed eleven-role enum and a required-field schema is
 * deterministic, repeatable, and boring â€” exactly the work that should cost zero
 * LLM tokens. It is also the one check that keeps the canvas honest: the stage
 * contract's success criteria explicitly forbid "a hand-authored node list." An
 * agent that hand-writes JSON can silently invent a tenth layer role, drop a
 * file:line, or typo a field name â€” this script rejects all three instead of
 * merging bad data into the canvas.
 *
 * It is called from SKILL.md step 4. Per invariant I8, a helper with no caller is
 * a soft fix â€” this one sits on the travelled path or it should not exist.
 *
 * Usage:
 *   node emit-canvas-nodes.mjs --cluster <name> --in <findings.json> [--out <path>]
 *   node emit-canvas-nodes.mjs --cluster <name> --in <findings.json> --dry-run
 *
 * --in       path to a JSON array of candidate nodes (see references/canvas-node-schema.md)
 * --out      path to the canvas node array to merge into. Defaults to
 *            <GRIOT_SANDBOX>/<cluster>/.griot-ux-canvas-nodes.json
 * --dry-run  validate only, do not write
 *
 * VALIDATION IS ALL-OR-NOTHING PER RUN. If any node in --in fails validation, the
 * script reports every violation and exits nonzero WITHOUT writing anything â€”
 * never a partial write, never a silently dropped node. Fix the findings JSON and
 * re-run.
 *
 * MERGE IS IDEMPOTENT BY id. Re-running a walk against the same target updates
 * existing nodes in place; it never duplicates.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

const SANDBOX = process.env.GRIOT_SANDBOX || "C:/Users/digit/GriotSandbox"

// â”€â”€ the ELEVEN layer roles, verbatim from LNAME (corrected 2026-09-12) â”€â”€â”€â”€
// Source: griot-suite-map.html LNAME array (artifact c389ca6c). Do not edit this
// list without re-checking that source â€” it is the entire output taxonomy.
const LAYER_ROLES = [
  "Djeli · container",
  "Collaboration · GenTeam",
  "Creation · build/content/3D",
  "Capture",
  "Intelligence · Super Agent",
  "Governance · Governor",
  "Model-making / data science",
  "Memory · foundation",
  "Deployment",
  "Suite meta",
  "Cross-cutting rails",
]
const VALID_LAYERS = new Set([...LAYER_ROLES, "unplaceable"])
const VALID_TYPES = new Set(["component", "screen", "flow", "workflow"])

// â”€â”€ args â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => {
  const i = argv.indexOf(n)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

const cluster = opt("--cluster")
const inPath = opt("--in")
const outPathArg = opt("--out")
const dryRun = flag("--dry-run")

if (!cluster || !inPath) {
  console.error(
    "Usage: node emit-canvas-nodes.mjs --cluster <name> --in <findings.json> [--out <path>] [--dry-run]"
  )
  process.exit(1)
}

if (!existsSync(inPath)) {
  console.error(`emit-canvas-nodes: --in file not found: ${inPath}`)
  process.exit(1)
}

const outPath = outPathArg || join(SANDBOX, cluster, ".griot-ux-canvas-nodes.json")

// â”€â”€ load candidate nodes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let candidates
try {
  candidates = JSON.parse(readFileSync(inPath, "utf-8"))
} catch (e) {
  console.error(`emit-canvas-nodes: could not parse --in as JSON: ${e.message}`)
  process.exit(1)
}
if (!Array.isArray(candidates)) {
  console.error("emit-canvas-nodes: --in must be a JSON array of nodes")
  process.exit(1)
}

// â”€â”€ validate every node â€” collect ALL violations, never stop at the first â”€â”€
function validateNode(node, idx) {
  const errs = []
  const where = `node[${idx}]${node && node.id ? ` (id=${node.id})` : ""}`

  if (!node || typeof node !== "object") return [`${where}: not an object`]
  if (!node.id || typeof node.id !== "string") errs.push(`${where}: missing/invalid "id"`)
  if (!VALID_TYPES.has(node.type))
    errs.push(`${where}: "type" must be one of ${[...VALID_TYPES].join(" | ")}, got ${JSON.stringify(node.type)}`)
  if (!node.label || typeof node.label !== "string") errs.push(`${where}: missing "label"`)
  if (!VALID_LAYERS.has(node.layer))
    errs.push(
      `${where}: "layer" must be one of the eleven verbatim roles or "unplaceable", got ${JSON.stringify(node.layer)}`
    )
  if (!node.position || typeof node.position.x !== "number" || typeof node.position.y !== "number")
    errs.push(`${where}: missing/invalid "position" {x, y}`)

  const data = node.data
  if (!data || typeof data !== "object") {
    errs.push(`${where}: missing "data"`)
    return errs
  }
  if (!data.origin || typeof data.origin.file !== "string" || !data.origin.file)
    errs.push(`${where}: missing "data.origin.file"`)
  if (!data.origin || typeof data.origin.line !== "number")
    errs.push(`${where}: missing/invalid "data.origin.line" â€” every finding needs file:line`)
  if (!data.mountPoint || typeof data.mountPoint !== "string")
    errs.push(`${where}: missing "data.mountPoint"`)
  if (!data.provenance || !data.provenance.harvestedBy)
    errs.push(`${where}: missing "data.provenance.harvestedBy"`)
  if (typeof data.licence !== "string" || !data.licence)
    errs.push(`${where}: missing "data.licence" â€” record as a fact (spdx:<id> | "none declared"), never omit`)

  return errs
}

const allErrors = candidates.flatMap((n, i) => validateNode(n, i))

if (allErrors.length > 0) {
  console.error(`emit-canvas-nodes: ${allErrors.length} violation(s) â€” nothing written.\n`)
  for (const e of allErrors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`emit-canvas-nodes: ${candidates.length} node(s) validated clean.`)

if (dryRun) {
  console.log("emit-canvas-nodes: --dry-run, not writing.")
  process.exit(0)
}

// â”€â”€ idempotent merge by id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let existing = []
if (existsSync(outPath)) {
  try {
    existing = JSON.parse(readFileSync(outPath, "utf-8"))
    if (!Array.isArray(existing)) existing = []
  } catch {
    existing = []
  }
}

const byId = new Map(existing.map((n) => [n.id, n]))
let updated = 0
let added = 0
for (const node of candidates) {
  if (byId.has(node.id)) updated++
  else added++
  byId.set(node.id, node)
}

const merged = [...byId.values()]
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n", "utf-8")

console.log(`emit-canvas-nodes: wrote ${outPath} â€” ${added} added, ${updated} updated, ${merged.length} total.`)
