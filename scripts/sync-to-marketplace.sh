#!/bin/sh
# sync-to-marketplace.sh - push THIS tool's plugin dirs into the shared
# digital-griot-marketplace repo as a thin <tool>-plugin/ folder, and upsert the
# tool's entry in the root marketplace.json.
#
# Ported unchanged from the canonical source (one home per fact, this is a port not
# a rewrite): C:\Users\digit\GriotMeta\digital-griot-marketplace\scripts\sync-to-marketplace.sh
# Edit the canonical copy, not this one, and re-port.
#
# GENERALIZES sync-prism-plugin.sh from a single-plugin force-push MIRROR to a
# MULTI-plugin shared MARKETPLACE. The critical difference: the marketplace houses
# every Griot tool, so this script must PRESERVE every other tool's folder. It
# therefore clones the marketplace, replaces ONLY this tool's subdir, upserts ONE
# manifest entry, and commits - it never force-pushes a fresh single commit (that
# would wipe the other tools).
#
# WHY a shared marketplace repo (same root cause as the prism-plugin mirror):
# Claude Desktop / Cowork's remote marketplace backend rejects source:"." and
# times out cloning a multi-GB tool monorepo. This repo is small (thin plugin
# dirs only, a few MB) and every entry uses a spec-valid relative "./<subdir>"
# source, so the backend clones fast and passes content validation.
#
# Run from a Griot tool repo root (or via its closing-ceremony release step):
#   sh scripts/sync-to-marketplace.sh
#
# Requires: a ./.claude-plugin/plugin.json (name [+ optional version/description])
# and the plugin dirs to ship (.claude-plugin skills agents commands hooks scripts -
# whichever exist). node + git must be on PATH; push auth (SSH/HTTPS) preconfigured.
#
# POSIX sh ONLY - see the LF/POSIX hook contract (PRISM-DOCUMENTATION-4.3.0).
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

MARKET_URL="${GRIOT_MARKETPLACE_URL:-git@github.com:TheDigitalGriot/digital-griot-marketplace.git}"
MARKET_REPO="TheDigitalGriot/digital-griot-marketplace"

[ -f ./.claude-plugin/plugin.json ] || { echo "ERR  no ./.claude-plugin/plugin.json - run from a tool repo root" >&2; exit 1; }

# Identify this tool from its plugin.json (version falls back to ./VERSION, then 0.0.0).
NAME=$(node -e "process.stdout.write(require('./.claude-plugin/plugin.json').name)")
VERSION=$(node -e "process.stdout.write(String(require('./.claude-plugin/plugin.json').version||''))")
[ -n "$VERSION" ] || VERSION=$(cat VERSION 2>/dev/null || echo "0.0.0")
DESC=$(node -e "process.stdout.write(require('./.claude-plugin/plugin.json').description||'')")
SUBDIR="${NAME}-plugin"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 1. Clone the shared marketplace (shallow) so we PRESERVE every other tool's folder.
git clone -q --depth 1 "$MARKET_URL" "$TMP/market"

# 2. Export ONLY this tool's plugin dirs (git archive respects .gitattributes eol=lf
#    and skips gitlinks - the same properties that make /prism-sideload zips reliable),
#    then replace the tool's subdir wholesale so deletions propagate.
STAGE="$TMP/stage"; mkdir -p "$STAGE"
DIRS=""
for d in .claude-plugin skills agents commands hooks scripts; do
  # test the committed tree (we archive HEAD), not the working dir - skips a
  # tracked-empty dir that would make `git archive` fail on an unmatched pathspec.
  git cat-file -e "HEAD:$d" 2>/dev/null && DIRS="$DIRS $d"
done
# shellcheck disable=SC2086
git archive HEAD $DIRS | tar -x -C "$STAGE"

rm -rf "$TMP/market/$SUBDIR"
mkdir -p "$TMP/market/$SUBDIR"
cp -R "$STAGE"/. "$TMP/market/$SUBDIR"/

# 3. Upsert this tool into the ROOT marketplace.json with a spec-valid relative
#    "./<subdir>" source (small repo => no clone timeout). The root manifest is the
#    single listing; the subdir's own .claude-plugin/plugin.json stays untouched.
node -e '
const fs=require("fs"),p=process.argv[1],name=process.argv[2],sub=process.argv[3],desc=process.argv[4],ver=process.argv[5];
const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.plugins=j.plugins||[];
const e={name,source:"./"+sub,description:desc,version:ver};
const i=j.plugins.findIndex(x=>x.name===name);
if(i>=0) j.plugins[i]=e; else j.plugins.push(e);
j.plugins.sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");
' "$TMP/market/.claude-plugin/marketplace.json" "$NAME" "$SUBDIR" "$DESC" "$VERSION"

# 4. Commit ONLY this tool's change (all other folders preserved) and push.
cd "$TMP/market"
git add -A
if git diff --cached --quiet; then
  echo "OK  $NAME already up to date in $MARKET_REPO"
else
  git commit -q -m "sync: $NAME v$VERSION"
  git push -q origin HEAD
  echo "OK  $NAME v$VERSION synced -> $MARKET_REPO/$SUBDIR"
fi
