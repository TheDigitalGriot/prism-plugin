#!/usr/bin/env bash
# Ralph Iterative Executor for Prism
# Spawns fresh Claude Code sessions in a loop to execute stories autonomously
#
# Usage: ./ralph.sh [stories-file]
#
# Environment Variables:
#   RALPH_MAX_ITERATIONS: Maximum iterations (default: 50)
#   RALPH_VERBOSE: Enable verbose output (default: false)
#   RALPH_PAUSE: Seconds between iterations (default: 2)
#
# Examples:
#   ./ralph.sh                                          # Use default stories.json
#   ./ralph.sh thoughts/shared/ralph/stories.json      # Specify stories file
#   RALPH_MAX_ITERATIONS=20 ./ralph.sh                 # Custom iteration limit
#   RALPH_VERBOSE=true ./ralph.sh                      # Verbose output

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STORIES_FILE="${1:-$PROJECT_DIR/thoughts/shared/ralph/stories.json}"
PROGRESS_FILE="${STORIES_FILE%/*}/progress.md"
MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-50}"
VERBOSE="${RALPH_VERBOSE:-false}"
PAUSE="${RALPH_PAUSE:-2}"

# Logging functions
log() { echo -e "${BLUE}[ralph]${NC} $(date +%H:%M:%S) $*"; }
success() { echo -e "${GREEN}[ralph]${NC} $(date +%H:%M:%S) $*"; }
warn() { echo -e "${YELLOW}[ralph]${NC} $(date +%H:%M:%S) $*"; }
error() { echo -e "${RED}[ralph]${NC} $(date +%H:%M:%S) ERROR: $*" >&2; }

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

# Get plan name
get_plan_name() {
    jq -r '.plan.name // "Unknown Plan"' "$STORIES_FILE"
}

# Initialize progress file if needed
init_progress() {
    if [[ ! -f "$PROGRESS_FILE" ]]; then
        local plan_name
        plan_name=$(get_plan_name)
        cat > "$PROGRESS_FILE" << EOF
---
plan: $plan_name
startedAt: $(date -Iseconds)
lastUpdated: $(date -Iseconds)
---

# Ralph Progress Log

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
    echo "  RALPH ITERATION $iteration of $MAX_ITERATIONS"
    echo "  Stories: $complete/$total complete ($remaining remaining)"
    echo "================================================================"
    echo ""
}

# Run single iteration
run_iteration() {
    local output
    local exit_code=0

    # Build the prompt for Claude
    local prompt="Execute the next story from $STORIES_FILE using the /prism-ralph workflow."

    # Run Claude with prism-ralph skill
    # Using --print to capture output, --dangerously-skip-permissions for autonomous operation
    if [[ "$VERBOSE" == "true" ]]; then
        output=$(claude --dangerously-skip-permissions --print "$prompt" 2>&1 | tee /dev/stderr) || exit_code=$?
    else
        output=$(claude --dangerously-skip-permissions --print "$prompt" 2>&1) || exit_code=$?
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
    if echo "$output" | grep -q '<ralph-continue>'; then
        return 1  # Continue
    fi

    # Check for retry
    if echo "$output" | grep -q '<ralph-retry>'; then
        warn "Iteration requested retry"
        return 2  # Retry
    fi

    # Check for blocked
    if echo "$output" | grep -q '<ralph-blocked>'; then
        warn "Story blocked, will try next available"
        return 1  # Continue with next story
    fi

    # Check for error
    if echo "$output" | grep -q '<ralph-error>'; then
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

    local plan_name
    plan_name=$(get_plan_name)

    local total
    total=$(count_total)

    log "Starting Ralph iterative execution"
    log "Plan: $plan_name"
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

        # Check signals
        check_signals "$output"
        local signal=$?

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
