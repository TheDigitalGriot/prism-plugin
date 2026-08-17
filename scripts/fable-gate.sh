#!/bin/sh
# fable-gate.sh — PreToolUse gate for policy-governed Task dispatches (surface "cli").
#
# Called by the PreToolUse hook (matcher "Task") before each Task tool call.
# Generalizes the original fable-only `fable.flag` gate into the Model Control
# Plane policy (packages/prism-core/src/core/api/model-policy.ts): it now governs
# BOTH premium models — opus5 and fable5 — applies each model's approval mode
# (ask|allow|deny|skip) read from `.prism/local/model-policy.json`, and — in ALL
# policy cases — EMITS a model-decision bus event so headless / Cowork runs are no
# longer silent about which premium model ran.
#
#   - The requested model comes from tool_input.model (an explicit Task override).
#   - fable / claude-fable-5 -> policy model "fable5"; opus5 / claude-opus-5 -> "opus5".
#     Every other model passes through untouched (no gate, no event).
#   - mode allow|skip -> permissionDecision "allow" (runs; event emitted).
#   - mode ask        -> permissionDecision "ask"   (human confirms; event emitted).
#   - mode deny       -> permissionDecision "deny"  (blocked; event names the
#     downgrade target from the fable5 -> opus5 -> opus chain).
#
# Reads the PreToolUse payload ({tool_name, tool_input, ...}) as JSON on stdin.
# JSON is parsed with node (no jq dependency; robust on Windows Git Bash), matching
# the repo's node/python hook convention. The policy read, decision, and event
# append all happen inside one node block that MIRRORS model-policy.ts minimally
# (the shell hook cannot import the TypeScript module). Emits a PreToolUse
# permission decision on stdout per the hook output protocol (see
# cl-plugin-structure/references/hook-events.md).
#
# Fail-open: a missing node, or any malformed policy, degrades to "allow" (with a
# best-effort event) so model governance never breaks Task dispatch.
#
# POSIX sh ONLY — cloud sandboxes may run hooks under dash/busybox, where a
# rejected `set` option exits 2 (= DENY in the hook protocol). pipefail is
# enabled only when the shell supports it; the pipelines below all carry their
# own `|| true` / `|| echo` guards, so its absence is safe.
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

# Read the hook payload from stdin (skip when attached to a terminal, e.g. debug).
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD=$(cat)
fi

# Extract the requested Task model override (tool_input.model). Empty if absent.
# Primary path: precise JSON parse via node (accurate). Only run node when it is
# actually on PATH so a missing/broken node is distinguishable from a genuinely
# empty/non-premium model below.
MODEL=""
if [ -n "$PAYLOAD" ] && command -v node >/dev/null 2>&1; then
  MODEL=$(printf '%s' "$PAYLOAD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const ti=j.tool_input||{};process.stdout.write(String(ti.model||""))}catch{process.stdout.write("")}})' 2>/dev/null || echo "")
fi

# Map the requested model id to a policy model id. Empty => not policy-governed.
POLICY_MODEL=""
case "$MODEL" in
  fable|claude-fable-5) POLICY_MODEL="fable5" ;;
  opus5|claude-opus-5)  POLICY_MODEL="opus5" ;;
esac

# Fail-safe net: if node was unavailable OR its precise parse missed on a genuinely
# policy-governed payload, grep the raw payload for an explicit premium model token
# so a governed dispatch always enters the gate. grep's no-match exit (1) must not
# abort under `set -e`, so it is confined to these `if` conditions.
if [ -z "$POLICY_MODEL" ] && [ -n "$PAYLOAD" ]; then
  if printf '%s' "$PAYLOAD" | grep -Eq '"model"[[:space:]]*:[[:space:]]*"(fable|claude-fable-5)"'; then
    POLICY_MODEL="fable5"
  elif printf '%s' "$PAYLOAD" | grep -Eq '"model"[[:space:]]*:[[:space:]]*"(opus5|claude-opus-5)"'; then
    POLICY_MODEL="opus5"
  fi
fi

# Only premium models are governed. Everything else passes through untouched.
if [ -z "$POLICY_MODEL" ]; then
  exit 0
fi

# Resolve the project dir: CLAUDE_PROJECT_DIR when set, else the hook's CWD.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# If node is unavailable we cannot read the policy or emit an event — fail open so
# the dispatch is never blocked by our own tooling gap (best-effort: no event).
if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

# Resolve the decision + emit the event via node. This block MIRRORS
# model-policy.ts minimally: readModelPolicy precedence (model-policy.json ->
# legacy fable.flag -> safe defaults), effectiveMode (surface "cli" override wins),
# the fable5 -> opus5 -> opus downgrade chain, resolveStateDir precedence, and the
# {type:"model-decision",...} event shape. It is wrapped in try/catch so ANY error
# degrades to an "allow" decision (fail-open) while still attempting the event.
# It prints the full hookSpecificOutput JSON to stdout (the hook decision channel).
POLICY_MODEL="$POLICY_MODEL" PROJECT_DIR="$PROJECT_DIR" node -e '
const fs=require("fs"),path=require("path");
const surface="cli";
const model=process.env.POLICY_MODEL;
const root=process.env.PROJECT_DIR||process.cwd();
const norm=v=>(v==="ask"||v==="allow"||v==="deny"||v==="skip")?v:undefined;
function readPolicy(){
  try{
    const p=JSON.parse(fs.readFileSync(path.join(root,".prism","local","model-policy.json"),"utf8"));
    return {
      headlessDefault:norm(p&&p.headlessDefault)||"allow",
      models:(p&&typeof p.models==="object"&&p.models)||{},
      surfaces:(p&&typeof p.surfaces==="object"&&p.surfaces)||{}
    };
  }catch(e){
    try{
      const f=JSON.parse(fs.readFileSync(path.join(root,".prism","local","fable.flag"),"utf8"));
      const on=f&&typeof f==="object"&&f.enabled===true;
      return {headlessDefault:"allow",models:{opus5:{mode:"ask"},fable5:{mode:on?"ask":"deny"}},surfaces:{}};
    }catch(e2){
      return {headlessDefault:"allow",models:{opus5:{mode:"ask"},fable5:{mode:"ask"}},surfaces:{}};
    }
  }
}
function stateDir(){
  if(process.env.GAVEL_STATE_DIR) return process.env.GAVEL_STATE_DIR;
  if(process.env.GAVEL_DIR) return path.join(process.env.GAVEL_DIR,"state");
  const base=path.join(root,".prism","local","gavel");
  try{
    if(fs.existsSync(base)){
      const s=fs.readdirSync(base).map(d=>path.join(base,d,"state")).filter(p=>fs.existsSync(p)).map(p=>({p,m:fs.statSync(p).mtimeMs})).sort((a,b)=>b.m-a.m);
      if(s.length) return s[0].p;
    }
  }catch(e){}
  return path.join(base,"_mcp","state");
}
function emit(ev){
  try{
    const file=path.join(stateDir(),"events");
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.appendFileSync(file,JSON.stringify(ev)+"\n","utf8");
  }catch(e){}
}
function out(decision,reason){
  process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:decision,permissionDecisionReason:reason}}));
}
try{
  const policy=readPolicy();
  const CHAIN=["fable5","opus5","opus"];
  const eff=m=>{
    const s=policy.surfaces[surface]&&policy.surfaces[surface][m]&&norm(policy.surfaces[surface][m].mode);
    if(s) return s;
    return (policy.models[m]&&norm(policy.models[m].mode))||"allow";
  };
  const nextRunnable=req=>{
    const i=CHAIN.indexOf(req);const start=i<0?0:i+1;
    for(let k=start;k<CHAIN.length;k++){const mm=eff(CHAIN[k]);if(mm==="allow"||mm==="skip") return CHAIN[k];}
    return "opus";
  };
  const mode=eff(model);
  let resolved=model,downgradedFrom,decision;
  if(mode==="allow"||mode==="skip"){decision="allow";}
  else if(mode==="deny"){decision="deny";resolved=nextRunnable(model);downgradedFrom=model;}
  else {decision="ask";}
  emit({type:"model-decision",requested:model,resolved:resolved,mode:mode,surface:surface,downgradedFrom:downgradedFrom,ts:new Date().toISOString()});
  const cost=model==="fable5"?" It draws on your capped weekly Max allowance.":"";
  const reason=decision==="deny"
    ? (model+" is denied by model policy — downgraded to "+resolved+".")
    : decision==="ask"
      ? (model+" requested (policy: ask)."+cost+" Confirm?")
      : (model+" allowed by model policy (mode "+mode+").");
  out(decision,reason);
}catch(e){
  emit({type:"model-decision",requested:model,resolved:model,mode:"allow",surface:surface,ts:new Date().toISOString()});
  out("allow","Model policy unavailable — failing open.");
}
' 2>/dev/null || exit 0
exit 0
