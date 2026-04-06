#!/usr/bin/env bash
# Visual Regression Testing for Prism
# Captures a screenshot via playwright-cli, diffs against a stored baseline,
# and outputs structured JSON results.
#
# Usage: visual-regression.sh <url> <baseline-dir> <name> [--threshold 0.01] [--viewport 1280x720]
#
# Arguments:
#   url           URL to capture (e.g., http://localhost:5173)
#   baseline-dir  Directory for baseline images (e.g., .prism/shared/validation/baselines/STORY-001)
#   name          Screenshot name (e.g., homepage, login-form)
#
# Options:
#   --threshold   Max allowed change percentage (default: 0.01 = 1%)
#   --viewport    Viewport size as WIDTHxHEIGHT (default: 1280x720)
#
# Output: JSON to stdout with fields:
#   name, url, baseline_path, screenshot_path, diff_path, change_pct, threshold, passed, new_baseline
#
# Exit: 0 if passed (change_pct <= threshold or new baseline), 1 if failed
#
# Examples:
#   visual-regression.sh http://localhost:5173 .prism/shared/validation/baselines/auth login-page
#   visual-regression.sh http://localhost:5173 ./baselines homepage --threshold 0.05
#   visual-regression.sh http://localhost:5173 ./baselines dashboard --viewport 375x812

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Temp files for cleanup
TEMP_DIR=""
SESSION_ID=""

cleanup() {
    if [[ -n "$SESSION_ID" ]]; then
        playwright-cli session-close "$SESSION_ID" 2>/dev/null || true
    fi
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# --- Argument Parsing ---

if [[ $# -lt 3 ]]; then
    echo >&2 "Usage: visual-regression.sh <url> <baseline-dir> <name> [--threshold 0.01] [--viewport 1280x720]"
    exit 2
fi

URL="$1"
BASELINE_DIR="$2"
NAME="$3"
shift 3

THRESHOLD="0.01"
VIEWPORT="1280x720"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --threshold)
            THRESHOLD="$2"
            shift 2
            ;;
        --viewport)
            VIEWPORT="$2"
            shift 2
            ;;
        *)
            echo >&2 "Unknown option: $1"
            exit 2
            ;;
    esac
done

VIEWPORT_WIDTH="${VIEWPORT%x*}"
VIEWPORT_HEIGHT="${VIEWPORT#*x}"

# --- JSON Output Helper ---

json_output() {
    local passed="$1"
    local change_pct="${2:-0}"
    local new_baseline="${3:-false}"
    local diff_path="${4:-null}"
    local screenshot_path="${5:-null}"
    local error="${6:-null}"

    # Quote string values, leave booleans/numbers/null unquoted
    local diff_val="null"
    [[ "$diff_path" != "null" ]] && diff_val="\"$diff_path\""

    local screenshot_val="null"
    [[ "$screenshot_path" != "null" ]] && screenshot_val="\"$screenshot_path\""

    local error_val="null"
    [[ "$error" != "null" ]] && error_val="\"$error\""

    cat <<ENDJSON
{
  "name": "$NAME",
  "url": "$URL",
  "viewport": "$VIEWPORT",
  "baseline_path": "$BASELINE_DIR/$NAME.png",
  "screenshot_path": $screenshot_val,
  "diff_path": $diff_val,
  "change_pct": $change_pct,
  "threshold": $THRESHOLD,
  "passed": $passed,
  "new_baseline": $new_baseline,
  "error": $error_val
}
ENDJSON
}

# --- Prerequisite Check ---

if ! command -v playwright-cli &>/dev/null; then
    echo >&2 "${RED}Error: playwright-cli is not installed or not in PATH${NC}"
    echo >&2 "Install it with: npm install -g @anthropic-ai/claude-code"
    json_output false 0 false null null "playwright-cli not found"
    exit 1
fi

# --- Setup ---

TEMP_DIR="$(mktemp -d)"
SESSION_ID="vr-${NAME}-$(date +%s)"
BASELINE_PATH="$BASELINE_DIR/$NAME.png"
SCREENSHOT_PATH="$TEMP_DIR/$NAME-current.png"

# Ensure baseline directory exists
mkdir -p "$BASELINE_DIR"

# --- Screenshot Capture ---

echo >&2 "${YELLOW}Capturing screenshot: $URL (${VIEWPORT})${NC}"

if ! playwright-cli screenshot \
    --session "$SESSION_ID" \
    --viewport-size "$VIEWPORT_WIDTH,$VIEWPORT_HEIGHT" \
    "$URL" \
    --output "$SCREENSHOT_PATH" 2>/dev/null; then
    echo >&2 "${RED}Error: Failed to capture screenshot of $URL${NC}"
    json_output false 0 false null null "Screenshot capture failed for $URL"
    exit 1
fi

# Close the session immediately after capture
playwright-cli session-close "$SESSION_ID" 2>/dev/null || true
SESSION_ID=""

if [[ ! -f "$SCREENSHOT_PATH" ]]; then
    echo >&2 "${RED}Error: Screenshot file was not created${NC}"
    json_output false 0 false null null "Screenshot file not created"
    exit 1
fi

# --- Baseline Check ---

if [[ ! -f "$BASELINE_PATH" ]]; then
    echo >&2 "${GREEN}No baseline found. Creating new baseline: $BASELINE_PATH${NC}"
    cp "$SCREENSHOT_PATH" "$BASELINE_PATH"
    json_output true 0 true null "$BASELINE_PATH"
    exit 0
fi

# --- Pixel Diff ---

echo >&2 "${YELLOW}Comparing against baseline: $BASELINE_PATH${NC}"

# Create diff output directory
DATE_DIR="$(date +%Y-%m-%d)"
DIFF_DIR="$(dirname "$BASELINE_DIR")/../diffs/$DATE_DIR"
mkdir -p "$DIFF_DIR"
DIFF_PATH="$DIFF_DIR/$NAME-diff.png"

# Use pixelmatch for comparison
# pixelmatch outputs: "<changed_pixels> pixels differ out of <total_pixels>"
DIFF_OUTPUT_FILE="$TEMP_DIR/diff-output.txt"

if command -v npx &>/dev/null; then
    # npx pixelmatch: compare two images, output diff image and stats
    if ! npx --yes pixelmatch \
        "$BASELINE_PATH" \
        "$SCREENSHOT_PATH" \
        "$DIFF_PATH" \
        "$THRESHOLD" \
        2>/dev/null > "$DIFF_OUTPUT_FILE"; then
        # pixelmatch exits non-zero when diff exceeds threshold
        # but still produces output — check if we got output
        if [[ ! -s "$DIFF_OUTPUT_FILE" ]]; then
            echo >&2 "${RED}Error: pixelmatch failed to compare images${NC}"
            json_output false 0 false null "$SCREENSHOT_PATH" "pixelmatch comparison failed"
            exit 1
        fi
    fi
else
    echo >&2 "${RED}Error: npx not found — cannot run pixelmatch${NC}"
    json_output false 0 false null "$SCREENSHOT_PATH" "npx not found for pixelmatch"
    exit 1
fi

# Parse pixelmatch output to get change percentage
# pixelmatch CLI outputs the number of differing pixels
DIFF_PIXELS="$(cat "$DIFF_OUTPUT_FILE" | tr -d '[:space:]')"

# Get total pixels from image dimensions
TOTAL_PIXELS=$(( VIEWPORT_WIDTH * VIEWPORT_HEIGHT ))

if [[ -z "$DIFF_PIXELS" || ! "$DIFF_PIXELS" =~ ^[0-9]+$ ]]; then
    echo >&2 "${RED}Error: Could not parse pixelmatch output${NC}"
    json_output false 0 false null "$SCREENSHOT_PATH" "Could not parse diff output"
    exit 1
fi

# Calculate change percentage
if [[ "$TOTAL_PIXELS" -gt 0 ]]; then
    CHANGE_PCT="$(awk "BEGIN {printf \"%.6f\", $DIFF_PIXELS / $TOTAL_PIXELS}")"
else
    CHANGE_PCT="0"
fi

# --- Threshold Check ---

PASSED="$(awk "BEGIN {print ($CHANGE_PCT <= $THRESHOLD) ? \"true\" : \"false\"}")"

if [[ "$PASSED" == "true" ]]; then
    echo >&2 "${GREEN}PASSED: ${CHANGE_PCT} change (threshold: ${THRESHOLD})${NC}"
    # Clean up diff image if passed — no regression
    [[ -f "$DIFF_PATH" ]] && rm -f "$DIFF_PATH"
    DIFF_PATH="null"
else
    echo >&2 "${RED}FAILED: ${CHANGE_PCT} change exceeds threshold ${THRESHOLD}${NC}"
    echo >&2 "  Diff image: $DIFF_PATH"
fi

json_output "$PASSED" "$CHANGE_PCT" false "$DIFF_PATH" "$SCREENSHOT_PATH"

if [[ "$PASSED" == "true" ]]; then
    exit 0
else
    exit 1
fi
