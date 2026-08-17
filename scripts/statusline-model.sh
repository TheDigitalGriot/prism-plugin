#!/bin/sh
# statusline-model.sh — Claude Code statusLine segment for the Model Control Plane.
#
# Configured as a `statusLine` command (see references/statusline-model.md), Claude
# Code pipes a status JSON to this script on stdin on every prompt. The JSON carries
# the ACTIVE model ({model:{id,display_name}}) and the workspace dir. This segment:
#   - maps the active model to a policy model id (claude-opus-5 -> opus5,
#     claude-fable-5 -> fable5);
#   - reads that model's approval mode from `.prism/local/model-policy.json`
#     (mirroring model-policy.ts readModelPolicy / effectiveMode minimally — a
#     statusLine script cannot import the TypeScript core);
#   - prints a compact "<model> · <mode>" segment, LOUD (bold ANSI ember, escalating
#     to red for a denied model) when the active model is a premium model
#     (opus5 / fable5) so a costly model is never running silently in the corner.
#
# Non-premium models print a quiet, dimmed name. Fail-safe: no stdin, no node, or a
# malformed policy degrades to a quiet segment (never a crash — a broken statusLine
# would spam the prompt).
#
# POSIX sh + the repo's node-parse convention (no jq). Prints ONE line on stdout.
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD=$(cat)
fi
[ -n "$PAYLOAD" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

printf '%s' "$PAYLOAD" | node -e '
const fs=require("fs"),path=require("path");
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  let j={};try{j=JSON.parse(s)}catch(e){process.exit(0)}
  const m=(j&&j.model)||{};
  const id=String(m.id||"");
  const name=String(m.display_name||id||"");
  const ws=(j&&j.workspace)||{};
  const root=ws.project_dir||ws.current_dir||j.cwd||process.cwd();
  let pm="";
  if(/fable-?5/i.test(id)||/fable/i.test(name)) pm="fable5";
  else if(/opus-?5/i.test(id)||/opus\s*5/i.test(name)) pm="opus5";
  if(!pm){
    if(!name) process.exit(0);
    process.stdout.write("\x1b[2m"+name+"\x1b[0m");
    process.exit(0);
  }
  const norm=v=>(v==="ask"||v==="allow"||v==="deny"||v==="skip")?v:undefined;
  let models={},surfaces={};
  try{
    const p=JSON.parse(fs.readFileSync(path.join(root,".prism","local","model-policy.json"),"utf8"));
    models=(p&&typeof p.models==="object"&&p.models)||{};
    surfaces=(p&&typeof p.surfaces==="object"&&p.surfaces)||{};
  }catch(e){
    try{
      const f=JSON.parse(fs.readFileSync(path.join(root,".prism","local","fable.flag"),"utf8"));
      const on=f&&typeof f==="object"&&f.enabled===true;
      models={opus5:{mode:"ask"},fable5:{mode:on?"ask":"deny"}};
    }catch(e2){models={opus5:{mode:"ask"},fable5:{mode:"ask"}};}
  }
  const so=surfaces.cli&&surfaces.cli[pm]&&norm(surfaces.cli[pm].mode);
  const mode=so||(models[pm]&&norm(models[pm].mode))||"ask";
  const color=mode==="deny"?"\x1b[1;38;5;196m":"\x1b[1;38;5;208m";
  process.stdout.write(color+"◆ "+pm+" · "+mode+"\x1b[0m");
});
' 2>/dev/null || exit 0
