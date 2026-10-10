#!/bin/bash
# Standalone Skill Validator
# Validates a standalone SKILL.md (a skill with NO .claude-plugin/plugin.json,
# e.g. anything in digital-griot-skills) for correct structure and content.
#
# WHY THIS SCRIPT EXISTS: `claude plugin validate .` requires a plugin.json and
# refuses to run against a standalone skill by design (see SKILL.md L216's
# standalone-vs-plugin file-resolution rule - standalone skills correctly have
# no plugin.json). Measured 2026-09-23: 104 skills in digital-griot-skills,
# 0 with a plugin.json, therefore 0 validatable by the plugin CLI. This script
# is the standalone-skill equivalent of that gate.
#
# Every rule below was derived from a survey of the 104-skill digital-griot-skills
# corpus, not invented - see .prism/shared/plans/architect-skill-validator-REPORT.md
# for the per-rule compliance table. A rule under ~95% corpus compliance is WARN,
# never FAIL.

set -euo pipefail

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/skill-dir>"
  echo ""
  echo "Validates a standalone skill directory for:"
  echo "  - SKILL.md present with well-formed YAML frontmatter"
  echo "  - Required fields (name, description)"
  echo "  - name is kebab-case; description does not break YAML parsing"
  echo "  - No literal tabs or smart quotes in the frontmatter block"
  echo "  - No stale deprecated-alias path references (icm-architect, cl-plugin-structure)"
  echo "  - (warn-only) name matches directory, description carries trigger phrasing,"
  echo "    referenced scripts/references/assets paths resolve, cloud/device block present"
  exit 1
fi

SKILL_DIR="${1%/}"

echo "🔍 Validating standalone skill: $SKILL_DIR"
echo ""

# Check 1: Directory exists
if [ ! -d "$SKILL_DIR" ]; then
  echo "❌ Directory not found: $SKILL_DIR"
  exit 1
fi
echo "✅ Directory exists"

# Check 2: SKILL.md exists
SKILL_FILE="$SKILL_DIR/SKILL.md"
if [ ! -f "$SKILL_FILE" ]; then
  echo "❌ SKILL.md not found: $SKILL_FILE"
  exit 1
fi
echo "✅ SKILL.md exists"

# --- Portable UTF-8 BOM tolerance --------------------------------------------
# Same rationale and same technique as validate-agent.sh: Windows editors prepend
# a 3-byte UTF-8 BOM (EF BB BF), which makes the first line literally `<BOM>---`
# and fails the "starts with ---" gate below on an otherwise-valid file. GNU-sed-only
# `\xEF` escapes are not portable (silent no-op on BSD/macOS sed), so detect with
# POSIX printf octal escapes and strip with `tail -c +4` instead.
#
# Normalize into a scan copy rather than filtering each read: under `set -o pipefail`
# an early-exiting `head -1` / `grep -q` SIGPIPEs the writer and aborts the script.
BOM=$(printf '\357\273\277')
SCAN_FILE="$SKILL_FILE"
if [ "$(head -c 3 "$SKILL_FILE" 2>/dev/null || true)" = "$BOM" ]; then
  SCAN_FILE=$(mktemp)
  trap 'rm -f "$SCAN_FILE"' EXIT
  tail -c +4 "$SKILL_FILE" > "$SCAN_FILE"
  echo "💡 Leading UTF-8 BOM detected — stripped for validation"
fi

# Check 3: Starts with ---
FIRST_LINE=$(head -1 "$SCAN_FILE")
if [ "$FIRST_LINE" != "---" ]; then
  echo "❌ SKILL.md must start with YAML frontmatter (---)"
  exit 1
fi
echo "✅ Starts with frontmatter"

# Check 4: Has closing ---
if ! tail -n +2 "$SCAN_FILE" | grep -q '^---$'; then
  echo "❌ Frontmatter not closed (missing second ---)"
  exit 1
fi
echo "✅ Frontmatter properly closed"

# Extract frontmatter block. NOTE: this deliberately does NOT reuse
# validate-agent.sh's / parse-frontmatter.sh's `sed -n '/^---$/,/^---$/{...}'`
# range pattern. That pattern RE-TRIGGERS on every later `---` pair in the file
# body (common as a markdown horizontal rule or as a fenced example of another
# file's own frontmatter) and silently concatenates unrelated body text into
# "frontmatter" - confirmed live against digital-griot-skills/plugin-settings,
# whose 22 body-level `---` lines make parse-frontmatter.sh return `name` as
# "Plugin Settings\nconfigured-agent" (the second line pulled from an in-body
# YAML example 15 lines later). validate-agent.sh itself avoids this same trap
# for its OWN system-prompt extraction via `awk '/^---$/{i++; next} i>=2'` -
# once the counter passes 2 it never returns to the vulnerable state. This
# script reuses that same awk idiom (i==1 instead of i>=2) to bound to exactly
# the FIRST frontmatter block. Reported as a discovered defect in the reference
# scripts rather than fixed there, per the Inputs section marking them
# "read first, do not edit".
FRONTMATTER=$(awk '/^---$/{i++; next} i==1' "$SCAN_FILE")
DIR_NAME="$(basename "$SKILL_DIR")"

echo ""
echo "Checking required fields..."

error_count=0
warning_count=0

# Field extraction intentionally does NOT shell out to parse-frontmatter.sh
# here - see the FRONTMATTER extraction comment above for why (it inherits the
# same multi-`---`-block bug). Pulled from this script's own correctly-bounded
# $FRONTMATTER instead, using the same grep+sed field-pull idiom
# parse-frontmatter.sh uses internally (strip a "field: " prefix, then a
# surrounding matched quote pair).
NAME=$(echo "$FRONTMATTER" | grep '^name:' | sed 's/^name: *//' | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\\(.*\\)'\$/\\1/" || true)

if [ -z "$NAME" ]; then
  echo "❌ Missing required field: name"
  error_count=$((error_count + 1))
else
  echo "✅ name: $NAME"

  # kebab-case format (98.1% corpus compliance - FAIL; plugin-settings and
  # plugin-structure are the two real Title Case offenders this catches)
  if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]]; then
    echo "❌ name must be kebab-case (lowercase alphanumeric and hyphens, start/end alphanumeric)"
    error_count=$((error_count + 1))
  fi

  # name matches directory (94.2% corpus compliance - WARN only; several
  # versioned/alt directories deliberately share a canonical name with a sibling)
  if [ "$NAME" != "$DIR_NAME" ]; then
    echo "⚠️  name '$NAME' does not match directory name '$DIR_NAME'"
    warning_count=$((warning_count + 1))
  fi
fi

# Raw description line (single line as it appears after "description:" - if the
# skill uses a YAML block scalar (`>`/`|`) this is just the block indicator, and
# that is treated as non-empty + skips the colon-space heuristic below on purpose:
# folded/literal block content cannot break plain-scalar parsing the way an
# unquoted inline value can).
DESC_RAW=$(echo "$FRONTMATTER" | grep '^description:' | sed 's/^description: *//' || true)

if [ -z "$DESC_RAW" ]; then
  echo "❌ Missing required field: description"
  error_count=$((error_count + 1))
else
  desc_length=${#DESC_RAW}
  echo "✅ description: ${desc_length} characters (first line)"

  # Block-scalar indicator ('>', '|', optionally chomped with -/+) - skip the
  # inline YAML-breakage heuristic below; folded/literal content is not a plain
  # scalar and colons inside it do not break parsing.
  if [[ "$DESC_RAW" =~ ^[\>\|][-+]?[[:space:]]*$ ]]; then
    :
  else
    # description parses as valid YAML - the N73 catch. A plain (unquoted) YAML
    # scalar cannot contain a colon immediately followed by a space; that is
    # parsed as a nested mapping key and throws "mapping values are not allowed
    # here". Proven live against
    # apps/prism-setup/resources/plugin/skills/prism-design/SKILL.md (dj/N73):
    # its unquoted description contains "require_brainstorm: false" inline and
    # fails yaml.safe_load with exactly that error.
    if [[ "$DESC_RAW" != \"*\" ]] && [[ "$DESC_RAW" != \'*\' ]] && [[ "$DESC_RAW" == *": "* ]]; then
      echo "❌ description breaks YAML parsing: unquoted value contains a colon-space sequence (quote the value or use a '>' block scalar)"
      error_count=$((error_count + 1))
    fi
  fi

  # Trigger phrasing (88.5% corpus compliance on the FULL folded value - WARN
  # only. Bash cannot fold a YAML block scalar without a real parser, so this
  # scans the whole frontmatter block rather than just $DESC_RAW - equivalent
  # in practice since these phrases do not otherwise appear in other fields).
  if ! echo "$FRONTMATTER" | grep -qiE 'use when|use this|trigger|triggers on'; then
    echo "⚠️  description should carry trigger phrasing (\"use when...\", \"triggers on...\")"
    warning_count=$((warning_count + 1))
  fi
fi

# No literal tabs in the YAML frontmatter block (99%+ corpus compliance - FAIL)
if printf '%s' "$FRONTMATTER" | grep -qP '\t' 2>/dev/null; then
  echo "❌ Literal tab character(s) in YAML frontmatter block"
  error_count=$((error_count + 1))
else
  echo "✅ No literal tabs in frontmatter"
fi

# No smart/curly quotes in the YAML frontmatter block (99%+ corpus compliance - FAIL)
if printf '%s' "$FRONTMATTER" | grep -qP '[\x{2018}\x{2019}\x{201C}\x{201D}]' 2>/dev/null; then
  echo "❌ Smart/curly quote character(s) in YAML frontmatter block"
  error_count=$((error_count + 1))
else
  echo "✅ No smart quotes in frontmatter"
fi

# No stale deprecated-alias PATH reference (98.1% corpus compliance - FAIL).
# Scoped to actual resolvable references (a skills/<alias>/ path or a
# /prism:<alias> invocation), not a bare mention of the word - griot-suite-context
# and dgs-plan-update both cite these alias names in prose ("both names resolve",
# "this is not cl-plugin-structure") and that is correct, documented aliasing
# per CLAUDE.md, not a defect.
if grep -qE 'skills/(icm-architect|cl-plugin-structure)/|/prism:(icm-architect|cl-plugin-structure)\b' "$SCAN_FILE"; then
  echo "❌ References a deprecated-alias path (icm-architect / cl-plugin-structure) instead of the canonical name (spectrum-architect / griot-agent-architect)"
  error_count=$((error_count + 1))
else
  echo "✅ No deprecated-alias path references"
fi

echo ""
echo "Checking bundled-resource conventions (informational)..."

# Referenced bundled paths resolve (~91% corpus compliance - WARN only; known
# false-positive class is a cross-repo/cross-skill path mentioned in backticks,
# e.g. another skill's own scripts/ dir, or the Prism repo's own scripts/ dir -
# this check has no way to know which repo a bare `scripts/x` in prose belongs
# to, so treat a hit here as "worth a look", not a confirmed defect).
HAS_BUNDLE_DIR=0
for sub in scripts references assets; do
  if [ -d "$SKILL_DIR/$sub" ]; then HAS_BUNDLE_DIR=1; fi
done

REF_MISSING=""
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  case "$ref" in
    */path/to/*|*'<'*'>'*) continue ;;
  esac
  if [ ! -e "$SKILL_DIR/$ref" ]; then
    REF_MISSING="$REF_MISSING $ref"
  fi
done < <(grep -oE '`(scripts|references|assets)/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*`' "$SCAN_FILE" | tr -d '`' | sort -u)

if [ -n "$REF_MISSING" ]; then
  echo "⚠️  Referenced bundled path(s) not found in this skill dir (may be a cross-repo mention):$REF_MISSING"
  warning_count=$((warning_count + 1))
elif [ $HAS_BUNDLE_DIR -eq 1 ]; then
  echo "✅ Referenced bundled paths resolve"
else
  echo "💡 No scripts/references/assets bundle referenced"
fi

# Cloud/device resolution block present when the skill bundles files (~88%
# corpus compliance - WARN only; the convention is still adopting across the
# corpus, per CLAUDE.md "saving and updating skills in the Cowork account").
if [ $HAS_BUNDLE_DIR -eq 1 ]; then
  if grep -qiE 'cloud[^.]{0,3}device|device-side resolution|device.side|account copy' "$SCAN_FILE"; then
    echo "✅ Cloud/device resolution note present"
  else
    echo "⚠️  Skill bundles files under scripts/references/assets but has no cloud/device resolution note"
    warning_count=$((warning_count + 1))
  fi
else
  echo "💡 No bundled files — cloud/device resolution note not applicable"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $error_count -eq 0 ] && [ $warning_count -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
elif [ $error_count -eq 0 ]; then
  echo "⚠️  Validation passed with $warning_count warning(s)"
  exit 0
else
  echo "❌ Validation failed with $error_count error(s) and $warning_count warning(s)"
  exit 1
fi
