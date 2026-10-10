#!/bin/sh
# sync-prism-plugin.sh - push the plugin dirs to the clean plugin-only mirror repo.
#
# WHY: Claude Desktop / Cowork's remote marketplace backend rejects two things:
#   1. source:"." in marketplace.json - the spec requires a "./subdir" relative
#      path or a source OBJECT (github/url/git-subdir); "." fails content
#      validation in ~2.6s (observed 2026-07-25, main.log status=failed_content).
#   2. a github/url source that points at the multi-GB main prism repo - the clone
#      times out (~11.8s failed_content, observed 2026-07-17).
# Fix: this mirror is small (six plugin dirs, a few MB) AND its marketplace.json
# sources the plugin via a github object pointing at THIS mirror repo - the exact
# shape anthropics/claude-plugins-official uses for its plugins. Small repo +
# valid source object => the backend clones fast and passes.
#
# Invoked from repo root (manually or by prism-release Step 6.5):
#   sh scripts/sync-prism-plugin.sh
#
# Mirror history is a single fresh commit per sync (force-push): the mirror is a
# build artifact, not a source of truth. Never edit the mirror directly.
#
# POSIX sh ONLY - see the LF/POSIX hook contract (PRISM-DOCUMENTATION-4.3.0).
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

MIRROR_URL="git@github.com:TheDigitalGriot/prism-plugin.git"
PLUGIN_REPO="TheDigitalGriot/prism-plugin"
VERSION=$(cat VERSION)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# git archive respects .gitattributes (eol=lf) and skips gitlinks - the same
# properties that make /prism-sideload zips reliable.
git archive HEAD .claude-plugin skills agents commands hooks scripts | tar -x -C "$TMP"

# Desktop/Cowork fix: rewrite plugins[].source from main's "." (correct only for a
# local CLI clone) to a github object at THIS small mirror repo, so the remote
# marketplace backend can resolve + crawl it. Main's marketplace.json is unchanged.
node -e "const fs=require('fs');const f=process.argv[1];const j=JSON.parse(fs.readFileSync(f,'utf8'));for(const p of (j.plugins||[])){p.source={source:'github',repo:process.argv[2]};}fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');" "$TMP/.claude-plugin/marketplace.json" "$PLUGIN_REPO"

cat > "$TMP/README.md" <<EOF
# Prism Plugin (marketplace)

Clean, self-contained plugin-only marketplace for Prism (https://github.com/TheDigitalGriot/prism) -
plugin dirs only, synced at **v$VERSION**. Plugin source is a github object pointing at
this repo, so Claude Desktop / Cowork can crawl it (unlike the multi-GB main repo).

Add in Claude Desktop / Cowork: Customize -> Plugins -> add marketplace TheDigitalGriot/prism-plugin.

Do not edit here: changes land in the main repo and are pushed by
scripts/sync-prism-plugin.sh (see prism-release Step 6.5).
EOF

cd "$TMP"
git init -q -b main
git remote add origin "$MIRROR_URL"
git add -A
git commit -q -m "sync: prism v$VERSION"
git push -q -f origin main
echo "OK  prism-plugin synced at v$VERSION -> $MIRROR_URL"