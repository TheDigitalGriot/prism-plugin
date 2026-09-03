#!/bin/bash
# Hook Schema Validator
# Validates hooks.json structure and checks for common issues.
# Accepts both root formats that Claude Code recognises:
#   Flat:   { "PreToolUse": [...], "PostToolUse": [...], ... }
#   Nested: { "hooks": { "PreToolUse": [...], "PostToolUse": [...], ... } }

set -euo pipefail

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/hooks.json>"
  echo ""
  echo "Validates hook configuration file for:"
  echo "  - Valid JSON syntax"
  echo "  - Required fields"
  echo "  - Hook type validity"
  echo "  - Matcher patterns"
  echo "  - Timeout ranges"
  exit 1
fi

HOOKS_FILE="$1"

if [ ! -f "$HOOKS_FILE" ]; then
  echo "❌ Error: File not found: $HOOKS_FILE"
  exit 1
fi

echo "🔍 Validating hooks configuration: $HOOKS_FILE"
echo ""

# Check 1: Valid JSON
echo "Checking JSON syntax..."
if ! jq empty "$HOOKS_FILE" 2>/dev/null; then
  echo "❌ Invalid JSON syntax"
  exit 1
fi
echo "✅ Valid JSON"

# Normalize root format to flat for uniform processing.
# Claude Code accepts:
#   Flat:   { "EventName": [...] }
#   Nested: { "hooks": { "EventName": [...] } }
ROOT_KEY_COUNT=$(jq 'keys | length' "$HOOKS_FILE")
FIRST_KEY=$(jq -r 'keys[0]' "$HOOKS_FILE")
WORK_FILE=$(mktemp)
trap 'rm -f "$WORK_FILE"' EXIT

if [ "$FIRST_KEY" = "hooks" ] && [ "$ROOT_KEY_COUNT" = "1" ]; then
  echo "  (nested form detected: { \"hooks\": {...} } — normalizing for validation)"
  jq '.hooks' "$HOOKS_FILE" > "$WORK_FILE"
else
  echo "  (flat form detected: { \"EventName\": [...] })"
  cp "$HOOKS_FILE" "$WORK_FILE"
fi

# Check 2: Root structure
echo ""
echo "Checking root structure..."
VALID_EVENTS=(
  "PreToolUse" "PostToolUse"
  "UserPromptSubmit"
  "Stop" "SubagentStop" "SubagentStart"
  "SessionStart" "SessionEnd"
  "PreCompact" "PostCompact"
  "WorktreeCreate" "WorktreeRemove"
  "Notification"
)

for event in $(jq -r 'keys[]' "$WORK_FILE" | tr -d '\r'); do
  found=false
  for valid_event in "${VALID_EVENTS[@]}"; do
    if [ "$event" = "$valid_event" ]; then
      found=true
      break
    fi
  done

  if [ "$found" = false ]; then
    echo "⚠️  Unknown event type: $event"
  fi
done
echo "✅ Root structure valid"

# Check 3: Validate each hook
echo ""
echo "Validating individual hooks..."

error_count=0
warning_count=0

for event in $(jq -r 'keys[]' "$WORK_FILE" | tr -d '\r'); do
  hook_count=$(jq -r ".\"$event\" | length" "$WORK_FILE")

  for ((i=0; i<hook_count; i++)); do
    # Check matcher field exists.
    # Empty string "" is a valid matcher meaning "match all" — check presence, not value.
    has_matcher=$(jq ".\"$event\"[$i] | has(\"matcher\")" "$WORK_FILE")
    if [ "$has_matcher" = "false" ]; then
      echo "❌ $event[$i]: Missing 'matcher' field"
      ((error_count++)) || true
      continue
    fi

    # Check hooks array exists
    hooks=$(jq -r ".\"$event\"[$i].hooks // empty" "$WORK_FILE")
    if [ -z "$hooks" ] || [ "$hooks" = "null" ]; then
      echo "❌ $event[$i]: Missing 'hooks' array"
      ((error_count++)) || true
      continue
    fi

    # Validate each hook in the array
    hook_array_count=$(jq -r ".\"$event\"[$i].hooks | length" "$WORK_FILE")

    for ((j=0; j<hook_array_count; j++)); do
      hook_type=$(jq -r ".\"$event\"[$i].hooks[$j].type // empty" "$WORK_FILE")

      if [ -z "$hook_type" ]; then
        echo "❌ $event[$i].hooks[$j]: Missing 'type' field"
        ((error_count++)) || true
        continue
      fi

      if [ "$hook_type" != "command" ] && [ "$hook_type" != "prompt" ]; then
        echo "❌ $event[$i].hooks[$j]: Invalid type '$hook_type' (must be 'command' or 'prompt')"
        ((error_count++)) || true
        continue
      fi

      # Check type-specific fields
      if [ "$hook_type" = "command" ]; then
        command=$(jq -r ".\"$event\"[$i].hooks[$j].command // empty" "$WORK_FILE")
        if [ -z "$command" ]; then
          echo "❌ $event[$i].hooks[$j]: Command hooks must have 'command' field"
          ((error_count++)) || true
        else
          # Check for hardcoded paths
          if [[ "$command" == /* ]] && [[ "$command" != *'${CLAUDE_PLUGIN_ROOT}'* ]]; then
            echo "⚠️  $event[$i].hooks[$j]: Hardcoded absolute path detected. Consider using \${CLAUDE_PLUGIN_ROOT}"
            ((warning_count++)) || true
          fi
        fi
      elif [ "$hook_type" = "prompt" ]; then
        prompt=$(jq -r ".\"$event\"[$i].hooks[$j].prompt // empty" "$WORK_FILE")
        if [ -z "$prompt" ]; then
          echo "❌ $event[$i].hooks[$j]: Prompt hooks must have 'prompt' field"
          ((error_count++)) || true
        fi

        # Check if prompt-based hooks are used on supported events
        if [ "$event" != "Stop" ] && [ "$event" != "SubagentStop" ] && [ "$event" != "UserPromptSubmit" ] && [ "$event" != "PreToolUse" ]; then
          echo "⚠️  $event[$i].hooks[$j]: Prompt hooks may not be fully supported on $event (best on Stop, SubagentStop, UserPromptSubmit, PreToolUse)"
          ((warning_count++)) || true
        fi
      fi

      # Check timeout
      timeout=$(jq -r ".\"$event\"[$i].hooks[$j].timeout // empty" "$WORK_FILE")
      if [ -n "$timeout" ] && [ "$timeout" != "null" ]; then
        if ! [[ "$timeout" =~ ^[0-9]+$ ]]; then
          echo "❌ $event[$i].hooks[$j]: Timeout must be a number"
          ((error_count++)) || true
        elif [ "$timeout" -gt 600 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout $timeout seconds is very high (max 600s)"
          ((warning_count++)) || true
        elif [ "$timeout" -lt 5 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout $timeout seconds is very low"
          ((warning_count++)) || true
        fi
      fi
    done
  done
done

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
