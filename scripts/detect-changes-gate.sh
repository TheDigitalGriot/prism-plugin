#!/bin/sh
# detect-changes-gate.sh — PostToolUse ADVISORY for codemem change-impact.
#
# Fires after Write|Edit. Runs `codebase-memory-mcp cli detect_changes` for the
# current project and, when the accumulated change's blast radius is HIGH or
# CRITICAL, surfaces a NON-blocking advisory. The advisory is emitted via BOTH a
# top-level `systemMessage` AND `hookSpecificOutput.additionalContext` (single
# JSON object) so it surfaces regardless of which field the runtime honors for
# PostToolUse. LOW / MEDIUM / none / any error -> no output. This hook NEVER
# blocks the tool: the edit already happened (PostToolUse), and we only ever
# emit that one advisory object (or nothing) and exit 0 on every path.
#
# ---------------------------------------------------------------------------
# detect_changes OUTPUT SHAPE (verified against the live CLI, not assumed):
#   {"changed_files":[...paths...],
#    "changed_count": <int>,
#    "impacted_symbols":[{"name","label","file"}...],   # blast radius, depth 2
#    "depth": <int>}
#   (wrapped by the CLI as {"content":[{"type":"text","text":"<json>"}],...})
#
# There is NO explicit severity/impact field (no "HIGH"/"CRITICAL"). We DERIVE
# severity from the blast-radius signal the tool DOES return:
#   * CODE = count of impacted_symbols whose label is a real code definition
#            (Function/Method/Class/Interface/Type/Struct/Enum/Trait/Constant/
#            Property). We deliberately EXCLUDE label "Section" (markdown headings)
#            and "Module" (file nodes) and "Variable" (config keys / locals) so a
#            docs- or config-heavy diff does not inflate the score.
#   * SRC  = count of changed_files with a source-code extension.
# Note: detect_changes compares the whole working tree vs base_branch (main), so
# this reflects the CUMULATIVE change set, not the single edit — the advisory is
# "your change set now has a HIGH/CRITICAL blast radius".
#
# Thresholds (heuristic; tune here). rank: 4=CRITICAL 3=HIGH 2=MED 1=LOW 0=none
#   CRITICAL: CODE >= 60 OR SRC >= 30
#   HIGH:     CODE >= 20 OR SRC >= 12
# Only rank >= 3 (HIGH/CRITICAL) is surfaced.
#
# NOISE / PERF GUARDS (PostToolUse fires after EVERY Write|Edit):
#   1. Source-file guard: skip immediately for non-source edits (docs/json/assets)
#      so we don't invoke codemem on every prose edit.
#   2. Rising-edge de-dup: emit only when the severity bucket RISES vs the last
#      run (state in .prism/local/detect-changes-gate.state, gitignored). Prevents
#      the same advisory on every subsequent edit once the diff is already big.
#   3. Runtime: ~0.79s end-to-end warm (detect_changes alone ~0.16s; the rest is
#      list_projects + node JSON parsing); the hooks.json `timeout` (15s) is the
#      outer guard. We avoid the shell `timeout` cmd (Windows timeout.exe has
#      different semantics under Git Bash).
#
# JSON is parsed with node (no jq dependency; robust on Windows Git Bash),
# matching scripts/fable-gate.sh convention.
#
# POSIX sh ONLY — cloud sandboxes may run hooks under dash/busybox. pipefail is
# enabled only when the shell supports it; every pipeline below already carries
# an `|| true` guard, so its absence is safe.
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

# Read the PostToolUse payload from stdin (skip when attached to a terminal).
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD=$(cat)
fi
[ -n "$PAYLOAD" ] || exit 0

# node is required for JSON parsing; without it, stay silent (never block).
command -v node >/dev/null 2>&1 || exit 0

# --- Guard 1: only run for source-code file edits -------------------------
# Extract tool_input.file_path (Write/Edit). Empty -> nothing to gate.
FILE_PATH=$(printf '%s' "$PAYLOAD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const ti=j.tool_input||{};process.stdout.write(String(ti.file_path||ti.path||""))}catch{process.stdout.write("")}})' 2>/dev/null || true)
[ -n "$FILE_PATH" ] || exit 0

FILE_LC=$(printf '%s' "$FILE_PATH" | tr 'A-Z' 'a-z')
case "$FILE_LC" in
  *.go|*.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.rs|*.java|*.rb|*.c|*.h|*.cc|*.cpp|*.hpp|*.cs|*.php|*.swift|*.kt|*.kts|*.scala|*.sh|*.bash|*.lua|*.dart|*.m|*.mm) ;;
  *) exit 0 ;;
esac

# Resolve the project dir (CLAUDE_PROJECT_DIR when set, else the hook's CWD).
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# --- Resolve the codemem project name by matching root_path ---------------
# Robust across path formats (C:\..  C:/..  /c/..): compare drive-stripped tails.
LIST=$(codebase-memory-mcp cli list_projects '{}' 2>/dev/null || true)
[ -n "$LIST" ] || exit 0
PROJECT_NAME=$(printf '%s' "$LIST" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{
    let raw=s;const b=raw.indexOf("{");if(b>=0)raw=raw.slice(b);
    let o=JSON.parse(raw);
    let inner=o&&o.content&&o.content[0]&&o.content[0].text?JSON.parse(o.content[0].text):o;
    const strip=p=>{p=String(p).replace(/\\\\/g,"/").toLowerCase().replace(/\/+$/,"");
      let m=p.match(/^[a-z]:(\/.*)$/);if(m)return m[1];
      m=p.match(/^\/[a-z](\/.*)$/);if(m)return m[1];
      return p.startsWith("/")?p:"/"+p;};
    const target=strip(process.argv[1]);
    for(const pr of (inner.projects||[])){if(strip(pr.root_path)===target){process.stdout.write(String(pr.name||""));return;}}
    process.stdout.write("");
  }catch{process.stdout.write("");}
});' "$PROJECT_DIR" 2>/dev/null || true)
# Not indexed / no match -> nothing to advise.
[ -n "$PROJECT_NAME" ] || exit 0

# --- Run detect_changes for the resolved project --------------------------
DETECT=$(codebase-memory-mcp cli detect_changes "{\"project\":\"$PROJECT_NAME\"}" 2>/dev/null || true)
[ -n "$DETECT" ] || exit 0

# --- Compute severity, apply rising-edge de-dup, emit advisory ------------
STATE_FILE="$PROJECT_DIR/.prism/local/detect-changes-gate.state"
OUT=$(printf '%s' "$DETECT" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const stateFile=process.argv[1];
  try{
    let raw=s;const b=raw.indexOf("{");if(b>=0)raw=raw.slice(b);
    let o=JSON.parse(raw);
    if(o&&o.isError){process.stdout.write("");return;}
    let d=o&&o.content&&o.content[0]&&o.content[0].text?JSON.parse(o.content[0].text):o;
    const CODE=new Set(["Function","Method","Class","Interface","Type","Struct","Enum","Trait","Constant","Property"]);
    const SRC=/\.(go|ts|tsx|js|jsx|mjs|cjs|py|rs|java|rb|c|h|cc|cpp|hpp|cs|php|swift|kt|kts|scala|sh|bash|lua|dart|m|mm)$/i;
    const code=(d.impacted_symbols||[]).filter(x=>x&&CODE.has(x.label)).length;
    const src=(d.changed_files||[]).filter(f=>SRC.test(String(f))).length;
    let rank=0;
    if(code>=60||src>=30)rank=4;
    else if(code>=20||src>=12)rank=3;
    else if(code>=8||src>=5)rank=2;
    else if(code>=1||src>=1)rank=1;
    // rising-edge de-dup
    const fs=require("fs"),path=require("path");
    let prev=0;try{prev=parseInt(fs.readFileSync(stateFile,"utf8").trim(),10)||0;}catch{}
    try{fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,String(rank));}catch{}
    if(rank<3||rank<=prev){process.stdout.write("");return;}
    const label=rank===4?"CRITICAL":"HIGH";
    const base=d.base_branch||"main",depth=d.depth==null?2:d.depth;
    const msg="codemem advisory: "+label+" change impact — "+code+" code symbol(s) across "+src+
      " changed source file(s) may be affected (blast radius, depth "+depth+", vs "+base+
      "). Non-blocking; review the blast radius before you commit.";
    // Emit the advisory via BOTH mechanisms so it surfaces regardless of which
    // field the runtime honors for PostToolUse: top-level `systemMessage` AND
    // `hookSpecificOutput.additionalContext` (with hookEventName). Single JSON object.
    process.stdout.write(JSON.stringify({systemMessage:msg,hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:msg}}));
  }catch{process.stdout.write("");}
});' "$STATE_FILE" 2>/dev/null || true)

if [ -n "$OUT" ]; then
  printf '%s\n' "$OUT"
fi
exit 0
