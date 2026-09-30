#!/usr/bin/env node
/**
 * harvest-survey.mjs — the mechanical half of a harvest ENTER stage.
 *
 * WHY THIS IS A SCRIPT AND NOT PROSE
 * ----------------------------------
 * Cloning + surveying a repo is deterministic, repeatable, and boring — exactly
 * the work that should cost zero LLM tokens. It also has a failure mode worth
 * encoding once: on 2026-09-06 a `du -sh` over the Puter tree blew a 2-minute
 * tool timeout and took the whole survey with it. This script therefore never
 * measures disk size; it counts files, which is O(entries) and never hangs.
 *
 * It is called from SKILL.md step 1. Per invariant I8, a helper with no caller
 * is a soft fix — this one sits on the travelled path or it should not exist.
 *
 * Usage:
 *   node harvest-survey.mjs --cluster <name> <repo-url|owner/repo> [...]
 *   node harvest-survey.mjs --cluster <name> --survey-only        # already cloned
 *   node harvest-survey.mjs --cluster <name> --json               # machine-readable
 *
 * Clones SHALLOW into <sandbox>/<cluster>/<repo>. Idempotent: an existing clone
 * is surveyed, never re-cloned and never clobbered.
 *
 * Emits per repo: last commit + age, file count, language mix, top-level layout,
 * README head, and LICENCE status.
 *
 * LICENCE IS REPORTED AS A FACT, NEVER A VERDICT. It populates a field
 * (`spdx | none declared`). It is not this script's business — nor the harvesting
 * agent's — to rule on what may be done with a repo. Studying, forking and
 * experimenting are never gated.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, statSync, readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const SANDBOX = process.env.GRIOT_SANDBOX || "C:/Users/digit/GriotSandbox"

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const CLUSTER = val("--cluster")
const JSON_OUT = flag("--json")
const SURVEY_ONLY = flag("--survey-only")
const repos = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--cluster")

if (!CLUSTER) {
  console.error("usage: harvest-survey.mjs --cluster <name> [repo-url|owner/repo ...] [--survey-only] [--json]")
  process.exit(2)
}

const root = join(SANDBOX, CLUSTER)
mkdirSync(root, { recursive: true })

// ── helpers ────────────────────────────────────────────────────────────────
const sh = (cmd, args, cwd, ms = 120000) => {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", timeout: ms, stdio: ["ignore", "pipe", "pipe"] }).trim()
  } catch { return null }
}

const nameOf = (spec) =>
  spec.replace(/\.git$/, "").replace(/\/+$/, "").split("/").pop()

const urlOf = (spec) =>
  /^https?:\/\//.test(spec) ? spec : `https://github.com/${spec}.git`

/** Walk a tree counting files by extension. Never measures bytes — see header. */
function walk(dir, out = { files: 0, ext: {}, dirs: 0 }, depth = 0) {
  if (depth > 12) return out
  let ents = []
  try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of ents) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "dist" || e.name === "target") continue
    const p = join(dir, e.name)
    if (e.isDirectory()) { out.dirs++; walk(p, out, depth + 1) }
    else {
      out.files++
      const m = e.name.match(/\.([A-Za-z0-9]{1,10})$/)
      if (m) out.ext[m[1].toLowerCase()] = (out.ext[m[1].toLowerCase()] || 0) + 1
    }
  }
  return out
}

const LICENCE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "LICENCE", "LICENSE-MIT", "LICENSE.rst"]

/** Returns an SPDX-ish string or "none declared". A FACT for a field — not a ruling. */
function licence(dir) {
  for (const f of LICENCE_FILES) {
    const p = join(dir, f)
    if (!existsSync(p)) continue
    let head = ""
    try { head = readFileSync(p, "utf8").slice(0, 900) } catch { return `${f} (unreadable)` }
    const pats = [
      [/MIT License/i, "MIT"], [/Apache License,?\s*Version 2\.0/i, "Apache-2.0"],
      [/GNU AFFERO/i, "AGPL-3.0"], [/GNU GENERAL PUBLIC LICENSE[\s\S]{0,120}Version 3/i, "GPL-3.0"],
      [/GNU GENERAL PUBLIC LICENSE[\s\S]{0,120}Version 2/i, "GPL-2.0"],
      [/GNU LESSER GENERAL PUBLIC/i, "LGPL"], [/Mozilla Public License/i, "MPL-2.0"],
      [/BSD 3-Clause/i, "BSD-3-Clause"], [/BSD 2-Clause/i, "BSD-2-Clause"],
      [/\bISC\b/i, "ISC"], [/The Unlicense/i, "Unlicense"],
      [/Business Source License/i, "BUSL-1.1"], [/Elastic License/i, "ELv2"],
    ]
    for (const [re, id] of pats) if (re.test(head)) return id
    return `${f} present (unrecognised — read it)`
  }
  return "none declared"
}

// ── clone ──────────────────────────────────────────────────────────────────
if (!SURVEY_ONLY) {
  for (const spec of repos) {
    const dest = join(root, nameOf(spec))
    if (existsSync(dest)) { console.error(`  = ${nameOf(spec)} already cloned — surveying, not re-cloning`); continue }
    console.error(`  + cloning ${spec} …`)
    const ok = sh("git", ["clone", "--depth", "1", "-q", urlOf(spec), dest], root, 300000)
    if (ok === null && !existsSync(dest)) console.error(`  ! FAILED to clone ${spec} — recorded as a gap, not silently skipped`)
  }
}

// ── survey ─────────────────────────────────────────────────────────────────
const rows = []
for (const d of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const dir = join(root, d.name)
  if (!existsSync(join(dir, ".git"))) continue
  const last = sh("git", ["log", "-1", "--format=%h|%ci|%s"], dir) || "|||"
  const [sha, date, subject] = last.split("|")
  const days = date ? Math.floor((Date.now() - Date.parse(date)) / 86400000) : null
  const w = walk(dir)
  const langs = Object.entries(w.ext).sort((a, b) => b[1] - a[1]).slice(0, 6)
  let readme = ""
  for (const f of ["README.md", "readme.md", "README.rst", "README"]) {
    if (existsSync(join(dir, f))) {
      try { readme = readFileSync(join(dir, f), "utf8").split("\n").filter((l) => l.trim()).slice(0, 6).join(" ").slice(0, 300) } catch {}
      break
    }
  }
  const top = readdirSync(dir).filter((n) => n !== ".git").slice(0, 14)
  rows.push({ repo: d.name, sha, date: (date || "").slice(0, 10), days, subject, files: w.files, dirs: w.dirs, langs, licence: licence(dir), top, readme })
}

if (JSON_OUT) { console.log(JSON.stringify({ cluster: CLUSTER, root, repos: rows }, null, 2)); process.exit(0) }

console.log(`\nHARVEST SURVEY — cluster "${CLUSTER}"  (${rows.length} repos)  ${root}\n`)
for (const r of rows) {
  const stale = r.days !== null && r.days > 180 ? "  ⚠ >6mo since last commit" : ""
  console.log(`${r.repo}`)
  console.log(`  last     ${r.sha}  ${r.date}  (${r.days}d ago)${stale}`)
  console.log(`  subject  ${(r.subject || "").slice(0, 84)}`)
  console.log(`  size     ${r.files} files / ${r.dirs} dirs`)
  console.log(`  langs    ${r.langs.map(([e, n]) => `${e}:${n}`).join("  ") || "—"}`)
  console.log(`  licence  ${r.licence}`)
  console.log(`  top      ${r.top.join(" ")}`)
  if (r.readme) console.log(`  readme   ${r.readme.slice(0, 190)}`)
  console.log("")
}
console.log(`Licence strings above are FACTS for a field, not rulings on use.\n`)
