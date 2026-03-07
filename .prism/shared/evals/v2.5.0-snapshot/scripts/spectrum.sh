#!/usr/bin/env bash
# Spectrum Iterative Executor for Prism
# Spawns fresh Claude Code sessions in a loop to execute stories autonomously
#
# Usage: spectrum [stories-file]
#
# Run from your PROJECT DIRECTORY (where .prism/ exists).
# The script uses the current working directory by default.
#
# Environment Variables:
#   SPECTRUM_MAX_ITERATIONS: Maximum iterations (default: 50)
#   SPECTRUM_VERBOSE: Enable verbose output (default: false)
#   SPECTRUM_PAUSE: Seconds between iterations (default: 2)
#
# Examples:
#   spectrum                                              # Run from project dir
#   spectrum .prism/stories/stories.json                 # Specify stories file
#   SPECTRUM_MAX_ITERATIONS=20 spectrum                  # Custom iteration limit
#   SPECTRUM_VERBOSE=true spectrum                       # Verbose output
#
# Setup (add to ~/.bashrc or ~/.zshrc):
#   alias spectrum='/path/to/prism-plugin/scripts/spectrum.sh'

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
# Use CURRENT WORKING DIRECTORY (where you run the command from)
PROJECT_DIR="$(pwd)"
STORIES_FILE="${1:-$PROJECT_DIR/.prism/stories/stories.json}"

# Derive progress path from stories path:
#   .prism/stories/stories.json           -> .prism/shared/spectrum/progress.md
#   .prism/stories/<epic>/stories.json    -> .prism/shared/spectrum/<epic>/progress.md
derive_progress_path() {
    local stories_path="$1"
    local stories_dir
    stories_dir="$(dirname "$stories_path")"
    local dir_name
    dir_name="$(basename "$stories_dir")"
    local parent_dir
    parent_dir="$(dirname "$stories_dir")"
    local parent_name
    parent_name="$(basename "$parent_dir")"

    if [[ "$parent_name" == "stories" ]]; then
        # Epic-scoped: .prism/stories/<epic>/stories.json
        local prism_dir
        prism_dir="$(dirname "$parent_dir")"
        echo "$prism_dir/shared/spectrum/$dir_name/progress.md"
    else
        # Legacy flat: .prism/stories/stories.json
        echo "$parent_dir/shared/spectrum/progress.md"
    fi
}

PROGRESS_FILE="$(derive_progress_path "$STORIES_FILE")"
MAX_ITERATIONS="${SPECTRUM_MAX_ITERATIONS:-50}"
VERBOSE="${SPECTRUM_VERBOSE:-false}"
PAUSE="${SPECTRUM_PAUSE:-2}"

# Logging functions
log() { echo -e "${BLUE}[spectrum]${NC} $(date +%H:%M:%S) $*"; }
success() { echo -e "${GREEN}[spectrum]${NC} $(date +%H:%M:%S) $*"; }
warn() { echo -e "${YELLOW}[spectrum]${NC} $(date +%H:%M:%S) $*"; }
error() { echo -e "${RED}[spectrum]${NC} $(date +%H:%M:%S) ERROR: $*" >&2; }

# Check prerequisites
check_prerequisites() {
    # Check for claude CLI
    if ! command -v claude &> /dev/null; then
        error "Claude CLI not found. Install with: npm install -g @anthropic/claude-code"
        exit 1
    fi

    # Check for jq (for JSON parsing)
    if ! command -v jq &> /dev/null; then
        error "jq not found. Install with your package manager (e.g., brew install jq)"
        exit 1
    fi

    # Check stories file exists
    if [[ ! -f "$STORIES_FILE" ]]; then
        error "Stories file not found: $STORIES_FILE"
        error "Run /decompose_plan first to generate stories.json"
        exit 1
    fi
}

# Count remaining stories
count_remaining() {
    jq '[.stories[] | select(.status != "complete")] | length' "$STORIES_FILE"
}

# Count total stories
count_total() {
    jq '.stories | length' "$STORIES_FILE"
}

# Get epic name
get_epic_name() {
    jq -r '.epic.name // "Unknown Epic"' "$STORIES_FILE"
}

# Initialize progress file if needed
init_progress() {
    if [[ ! -f "$PROGRESS_FILE" ]]; then
        local epic_name
        epic_name=$(get_epic_name)
        local progress_dir
        progress_dir=$(dirname "$PROGRESS_FILE")
        mkdir -p "$progress_dir"
        cat > "$PROGRESS_FILE" << EOF
---
epic: $epic_name
startedAt: $(date -Iseconds)
lastUpdated: $(date -Iseconds)
---

# Spectrum Progress Log

## Codebase Patterns (Consolidated)

*Patterns will be added as iterations discover them*

---

EOF
        log "Created progress file: $PROGRESS_FILE"
    fi
}

# Print status banner
print_banner() {
    local iteration=$1
    local remaining=$2
    local total=$3
    local complete=$((total - remaining))

    echo ""
    echo "================================================================"
    echo "  SPECTRUM ITERATION $iteration of $MAX_ITERATIONS"
    echo "  Stories: $complete/$total complete ($remaining remaining)"
    echo "================================================================"
    echo ""
}

# Run single iteration
run_iteration() {
    local output
    local exit_code=0

    # Build the prompt for Claude
    local prompt="Execute the next story from $STORIES_FILE using the /prism-spectrum workflow. Progress file: $PROGRESS_FILE"

    # Run Claude with prism-spectrum skill from the project directory
    # Using --print to capture output, --dangerously-skip-permissions for autonomous operation
    if [[ "$VERBOSE" == "true" ]]; then
        output=$(cd "$PROJECT_DIR" && claude --dangerously-skip-permissions --print "$prompt" 2>&1 | tee /dev/stderr) || exit_code=$?
    else
        output=$(cd "$PROJECT_DIR" && claude --dangerously-skip-permissions --print "$prompt" 2>&1) || exit_code=$?
    fi

    # Return the output for signal checking
    echo "$output"
    return $exit_code
}

# Check output for signals
check_signals() {
    local output="$1"

    # Check for completion
    if echo "$output" | grep -q '<promise>COMPLETE</promise>'; then
        return 0  # Complete
    fi

    # Check for continue
    if echo "$output" | grep -q '<spectrum-continue>'; then
        return 1  # Continue
    fi

    # Check for retry
    if echo "$output" | grep -q '<spectrum-retry>'; then
        warn "Iteration requested retry"
        return 2  # Retry
    fi

    # Check for blocked
    if echo "$output" | grep -q '<spectrum-blocked>'; then
        warn "Story blocked, will try next available"
        return 1  # Continue with next story
    fi

    # Check for error
    if echo "$output" | grep -q '<spectrum-error>'; then
        error "Fatal error detected in output"
        return 3  # Error
    fi

    # No explicit signal - assume continue
    return 1
}

# Main loop
main() {
    check_prerequisites
    init_progress

    local epic_name
    epic_name=$(get_epic_name)

    local total
    total=$(count_total)

    log "Starting Spectrum iterative execution"
    log "Project: $PROJECT_DIR"
    log "Epic: $epic_name"
    log "Stories file: $STORIES_FILE"
    log "Total stories: $total"
    log "Max iterations: $MAX_ITERATIONS"
    echo ""

    local iteration=0
    local remaining
    local consecutive_errors=0
    local max_consecutive_errors=3

    while [[ $iteration -lt $MAX_ITERATIONS ]]; do
        iteration=$((iteration + 1))
        remaining=$(count_remaining)

        print_banner "$iteration" "$remaining" "$total"

        # Check if already complete
        if [[ $remaining -eq 0 ]]; then
            success "All stories complete!"
            break
        fi

        # Run iteration
        local output
        output=$(run_iteration) || true

        # Check signals (capture return code without triggering set -e)
        local signal=0
        check_signals "$output" || signal=$?

        case $signal in
            0)  # Complete
                success "Received COMPLETE signal"
                success "All stories complete!"
                break
                ;;
            1)  # Continue
                log "Iteration $iteration complete"
                consecutive_errors=0
                ;;
            2)  # Retry
                warn "Retry requested, continuing..."
                consecutive_errors=$((consecutive_errors + 1))
                ;;
            3)  # Error
                error "Fatal error, stopping"
                consecutive_errors=$((consecutive_errors + 1))
                ;;
        esac

        # Check for too many consecutive errors
        if [[ $consecutive_errors -ge $max_consecutive_errors ]]; then
            error "Too many consecutive errors ($max_consecutive_errors), stopping"
            exit 1
        fi

        # Pause between iterations
        if [[ $remaining -gt 0 ]] && [[ $iteration -lt $MAX_ITERATIONS ]]; then
            log "Pausing ${PAUSE}s before next iteration..."
            sleep "$PAUSE"
        fi
    done

    # Final status
    echo ""
    echo "================================================================"
    remaining=$(count_remaining)
    local complete=$((total - remaining))

    if [[ $remaining -eq 0 ]]; then
        success "SUCCESS: All $total stories complete"
        success "Completed in $iteration iterations"
        echo "================================================================"
        exit 0
    else
        warn "Reached max iterations ($MAX_ITERATIONS)"
        warn "Completed: $complete/$total stories"
        warn "Remaining: $remaining stories"
        echo ""
        warn "Check progress: $PROGRESS_FILE"
        warn "Check stories: $STORIES_FILE"
        echo "================================================================"
        exit 1
    fi
}

# Run main function
main "$@"
