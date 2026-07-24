#!/bin/sh
# sync-marketplace.sh — push the plugin dirs to the thin marketplace mirror repo.
#
# WHY: Claude Desktop's marketplace backend settles `failed_content` on the full
# ~121 MB prism monorepo (observed 2026-07-17; Desktop main.log). The mirror is
# ONLY the six plugin dirs (~a few MB), which the backend can process. Point the
# Desktop marketplace at TheDigitalGriot/prism-marketplace instead of the monorepo.
#
# Invoked from repo root (manually or by prism-release Step 6.5):
#   sh scripts/sync-marketplace.sh
#
# Mirror history is a single fresh commit per sync (force-push): the mirror is a
# build artifact, not a source of truth. Never edit the mirror directly.
#
# POSIX sh ONLY — see the LF/POSIX hook contract (PRISM-DOCUMENTATION-4.3.0).
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

MIRROR_URL="git@github.com:TheDigitalGriot/prism-marketplace.git"
VERSION=$(cat VERSION)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# git archive respects .gitattributes (eol=lf) and skips gitlinks — the same
# properties that make /prism-sideload zips reliable.
git archive HEAD .claude-plugin skills agents commands hooks scripts | tar -x -C "$TMP"

cat > "$TMP/README.md" <<EOF
# Prism Marketplace (mirror)

Thin marketplace mirror of [TheDigitalGriot/prism](https://github.com/TheDigitalGriot/prism) —
plugin dirs only, synced at **v$VERSION**.

Do not edit here: changes land in the main repo and are pushed by
\`scripts/sync-marketplace.sh\` (see prism-release Step 6.5).
EOF

cd "$TMP"
git init -q -b main
git remote add origin "$MIRROR_URL"
git add -A
git commit -q -m "sync: prism v$VERSION"
git push -q -f origin main
echo "OK  mirror synced at v$VERSION -> $MIRROR_URL"
