#!/usr/bin/env node
/**
 * verify-model-policy-conformance.mjs — cross-copy conformance gate.
 *
 * WHY: the Model Control Plane's decision logic is deliberately mirrored in four
 * places because they cannot import each other — a TypeScript core, two embedded
 * node blocks inside POSIX shell hooks, and a separate mobile server copy:
 *
 *   1. packages/prism-core/src/core/api/model-policy.ts          (canonical)
 *   2. scripts/fable-gate.sh                    (embedded node, surface "cli")
 *   3. scripts/statusline-model.sh              (embedded node, display only)
 *   4. apps/prism-mobile/.../agent/model-policy.ts               (mobile server)
 *
 * The v4.11.0 CHANGELOG named "a cross-copy conformance check for the
 * downgrade-chain logic now mirrored in three places" as a known follow-up. It was
 * never written, and the copies drifted: the v4.13.0 audit found the shell gate
 * matching Fable by EXACT string (so `claude-fable-5-1` dispatched UNGATED), and
 * the vscode gate omitting the `opus` alias (so post-alias-flip dispatches emitted
 * no bus event at all). Both were silent failures — nothing errored, the gate just
 * stopped gating.
 *
 * This script is the missing check. It is static analysis, not execution: it reads
 * each file as text and asserts the invariants agree. Picked up automatically by
 * scripts/pre-release-audit.mjs, which globs verify-*.mjs.
 *
 * Exit 0 = conformant. Exit 1 = drift (prints every divergence).
 */
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const FILES = {
  core: "packages/prism-core/src/core/api/model-policy.ts",
  gate: "scripts/fable-gate.sh",
  statusline: "scripts/statusline-model.sh",
  mobile: "apps/prism-mobile/packages/server/src/server/agent/model-policy.ts",
  vscodeGate: "apps/prism-vscode/src/core/api/fable-gate.ts",
  sdk: "apps/prism-vscode/src/core/api/claude-sdk.ts",
  example: "model-policy.example.json",
}

/** The single source of truth this gate enforces. Update here when the line moves. */
const EXPECTED = {
  chain: ["fable5", "opus5", "opus48"],
  floor: "opus48",
  modes: { opus5: "allow", fable5: "ask" },
  headlessDefault: "allow",
  currentIds: [
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-fable-5-1",
    "claude-haiku-4-5-20251001",
  ],
  /** Superseded ids that must NOT appear outside a deliberate legacy pin. */
  supersededIds: ["claude-sonnet-4-6", "claude-mythos-preview"],
  legacyPin: "claude-opus-4-8",
}

const failures = []
const notes = []
const fail = (where, msg) => failures.push(`${where}: ${msg}`)

function read(key) {
  const p = join(ROOT, FILES[key])
  if (!existsSync(p)) {
    fail(key, `file not found — ${FILES[key]}`)
    return null
  }
  return readFileSync(p, "utf8")
}

const src = Object.fromEntries(Object.keys(FILES).map((k) => [k, read(k)]))

// ── 1. Downgrade chain: same members, same order, in all three copies that have one
const chainRe = /\[\s*"fable5"\s*,\s*"opus5"\s*,\s*"([a-z0-9]+)"\s*\]/
for (const key of ["core", "mobile"]) {
  if (!src[key]) continue
  const m = src[key].match(chainRe)
  if (!m) fail(key, "DOWNGRADE_CHAIN not found or not in the expected [fable5, opus5, X] shape")
  else if (m[1] !== EXPECTED.chain[2])
    fail(key, `chain terminates at "${m[1]}", expected "${EXPECTED.chain[2]}"`)
}
if (src.gate) {
  const m = src.gate.match(/CHAIN\s*=\s*\[\s*"fable5"\s*,\s*"opus5"\s*,\s*"([a-z0-9]+)"\s*\]/)
  if (!m) fail("gate", "CHAIN not found in the embedded node block")
  else if (m[1] !== EXPECTED.chain[2])
    fail("gate", `chain terminates at "${m[1]}", expected "${EXPECTED.chain[2]}"`)
}

// ── 2. Floor model
for (const key of ["core", "mobile"]) {
  if (!src[key]) continue
  const m = src[key].match(/FLOOR_MODEL\s*[:=]\s*"([a-z0-9]+)"/)
  if (!m) fail(key, "FLOOR_MODEL not found")
  else if (m[1] !== EXPECTED.floor)
    fail(key, `FLOOR_MODEL is "${m[1]}", expected "${EXPECTED.floor}"`)
}

// ── 3. Default modes — opus5 must be "allow" (it carries NO model-level gate),
//      fable5 must be "ask" (HITL-gated). A regression here silently re-gates the
//      routine ceiling or, far worse, un-gates Fable.
const modeRe = (model) => new RegExp(`${model}\\s*:\\s*\\{\\s*mode\\s*:\\s*"(\\w+)"`)
for (const key of ["gate", "statusline", "mobile"]) {
  if (!src[key]) continue
  for (const [model, want] of Object.entries(EXPECTED.modes)) {
    const matches = [...src[key].matchAll(new RegExp(modeRe(model).source, "g"))]
    if (!matches.length) {
      fail(key, `no default mode found for "${model}"`)
      continue
    }
    // fable5 legitimately appears as a ternary in the legacy-flag branch
    // (on ? "ask" : "deny"); only flag a literal that is neither expected value.
    const bad = matches.filter((m) => m[1] !== want && !(model === "fable5" && m[1] === "deny"))
    if (bad.length) fail(key, `"${model}" defaults to "${bad[0][1]}", expected "${want}"`)
  }
}
if (src.core) {
  if (!/DEFAULT_OPUS5_MODE\s*:\s*ApprovalMode\s*=\s*"allow"/.test(src.core))
    fail("core", 'DEFAULT_OPUS5_MODE must be "allow" — Opus 5 carries no model-level gate')
  if (!/DEFAULT_MODE\s*:\s*ApprovalMode\s*=\s*"ask"/.test(src.core))
    fail("core", 'DEFAULT_MODE must be "ask" — it is the Fable gate default')
}
if (src.example) {
  let j
  try {
    j = JSON.parse(src.example)
  } catch {
    fail("example", "model-policy.example.json is not valid JSON")
  }
  if (j) {
    for (const [model, want] of Object.entries(EXPECTED.modes)) {
      const got = j.models?.[model]?.mode
      if (got !== want) fail("example", `models.${model}.mode is "${got}", expected "${want}"`)
    }
    if (j.headlessDefault !== EXPECTED.headlessDefault)
      fail("example", `headlessDefault is "${j.headlessDefault}"`)
  }
}

// ── 4. THE SECURITY INVARIANT: Fable must be matched by PREFIX, never exact.
//      An exact `claude-fable-5` test silently fails to gate `claude-fable-5-1`,
//      letting a premium, HITL-gated model dispatch completely ungoverned.
//
//      MUST strip comments first. The prose above the `case` statement explains
//      the prefix rule and therefore CONTAINS the very string we look for — an
//      unscoped search matches the comment and passes even when the executable
//      line has regressed to an exact match. (Caught by mutation-testing this
//      gate: without the strip, reverting the fix still reported conformant.)
if (src.gate) {
  const code = src.gate
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n")
  const caseLine = code.match(/^\s*fable\|[^)]*\)\s*POLICY_MODEL="fable5"/m)?.[0] ?? ""
  if (!caseLine) fail("gate", "could not locate the `fable|... ) POLICY_MODEL=\"fable5\"` case arm")
  else if (!/claude-fable-5-\*/.test(caseLine))
    fail(
      "gate",
      `case arm matches Fable by EXACT string — point releases bypass the gate entirely. Found: ${caseLine.trim()}`,
    )
  const grepLine = code.match(/grep -Eq '"model".*fable[^']*'/)?.[0] ?? ""
  if (!grepLine) fail("gate", "could not locate the Fable grep fail-safe")
  else if (!/claude-fable-5\(-\[0-9\]\+\)\*/.test(grepLine))
    fail("gate", "grep fail-safe matches Fable by exact string — must allow point-release suffixes")
}
if (src.mobile && !/startsWith\("claude-fable-5-"\)/.test(src.mobile))
  fail("mobile", "policyKeyForModel must match Fable by prefix via startsWith(\"claude-fable-5-\")")
if (src.statusline && !/fable-\?5/.test(src.statusline))
  fail("statusline", "model regex must match Fable point releases")

// ── 5. The `opus` alias must be policy-governed on the vscode surface.
//      Post-alias-flip `opus` resolves to claude-opus-5 — the same id as `opus5` —
//      so omitting it means the default alias skips the plane and emits NO event.
if (src.vscodeGate) {
  const map = src.vscodeGate.match(/MODELNAME_TO_POLICY[^=]*=\s*\{([^}]*)\}/s)?.[1] ?? ""
  if (!/\bopus\s*:\s*"opus5"/.test(map))
    fail("vscodeGate", 'MODELNAME_TO_POLICY must map `opus: "opus5"` — otherwise the default alias dispatches ungoverned and emits no bus event')
  if (!/\bfable\s*:\s*"fable5"/.test(map)) fail("vscodeGate", "MODELNAME_TO_POLICY must map fable")
}

// ── 6. Model ids agree with the current line
if (src.sdk) {
  for (const id of EXPECTED.currentIds)
    if (!src.sdk.includes(id)) fail("sdk", `MODEL_IDS is missing the current id "${id}"`)
  if (!src.sdk.includes(EXPECTED.legacyPin))
    notes.push(`sdk: legacy pin "${EXPECTED.legacyPin}" absent — intentional only if opus48 was retired`)
  for (const id of EXPECTED.supersededIds)
    if (src.sdk.includes(id)) fail("sdk", `MODEL_IDS still references superseded id "${id}"`)
  // claude-fable-5 without the -1 suffix is the exact bug this gate exists for.
  if (/"claude-fable-5"/.test(src.sdk))
    fail("sdk", 'MODEL_IDS pins "claude-fable-5" — superseded by "claude-fable-5-1"')
}

// ── Report
const label = "verify-model-policy-conformance"
if (notes.length) for (const n of notes) console.log(`  note  ${label}: ${n}`)
if (failures.length) {
  console.error(`\n✗ ${label}: ${failures.length} divergence(s) across the mirrored policy copies\n`)
  for (const f of failures) console.error(`    - ${f}`)
  console.error(
    "\n  These four copies cannot import each other, so they drift silently.\n" +
      "  Fix the divergence — do not weaken this check.\n",
  )
  process.exit(1)
}
console.log(`✓ ${label}: all mirrored model-policy copies agree (chain, floor, defaults, Fable prefix-match, model ids)`)
