#!/usr/bin/env bash
# ============================================================================
# test_install.sh — Standalone test runner for prism-cli-install.sh
# ============================================================================
# No external dependencies needed. Just bash.
#
# Run:
#   bash scripts/tests/test_install.sh
#
# From repo root:
#   bash scripts/tests/test_install.sh ../prism-cli-install.sh
# ============================================================================

set +e  # Don't exit on error — we handle errors in assertions
set -uo pipefail

# ── Test framework ──────────────────────────────────────────────────────────

PASSED=0
FAILED=0
SKIPPED=0
ERRORS=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

pass() { ((PASSED++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAILED++)); ERRORS+=("$1: $2"); echo -e "  ${RED}✗${NC} $1 — ${DIM}$2${NC}"; }
skip() { ((SKIPPED++)); echo -e "  ${YELLOW}⊘${NC} $1 ${DIM}(skipped: $2)${NC}"; }

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
        pass "$label"
    else
        fail "$label" "expected='$expected' actual='$actual'"
    fi
}

assert_contains() {
    local label="$1" haystack="$2" needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        pass "$label"
    else
        fail "$label" "string does not contain '$needle'"
    fi
}

assert_file_exists() {
    local label="$1" path="$2"
    if [[ -f "$path" ]]; then
        pass "$label"
    else
        fail "$label" "file not found: $path"
    fi
}

assert_dir_exists() {
    local label="$1" path="$2"
    if [[ -d "$path" ]]; then
        pass "$label"
    else
        fail "$label" "directory not found: $path"
    fi
}

assert_file_executable() {
    local label="$1" path="$2"
    if [[ -x "$path" ]]; then
        pass "$label"
    else
        fail "$label" "file not executable: $path"
    fi
}

assert_file_contains() {
    local label="$1" path="$2" pattern="$3"
    if grep -q "$pattern" "$path" 2>/dev/null; then
        pass "$label"
    else
        fail "$label" "file '$path' does not contain '$pattern'"
    fi
}

assert_exit_code() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
        pass "$label"
    else
        fail "$label" "expected exit code $expected, got $actual"
    fi
}

# ── Sandbox setup/teardown ──────────────────────────────────────────────────

ORIG_HOME=""
SANDBOX=""

sandbox_setup() {
    ORIG_HOME="$HOME"
    SANDBOX="$(mktemp -d)"
    export HOME="$SANDBOX"
    export PRISM_BIN_DIR="$HOME/.prism/bin"
    export INSTALL_DIR="$PRISM_BIN_DIR"
}

sandbox_teardown() {
    rm -rf "$SANDBOX"
    export HOME="$ORIG_HOME"
    unset PRISM_BIN_DIR INSTALL_DIR
}

# ── Source the script under test ────────────────────────────────────────────

SCRIPT_PATH="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/prism-cli-install.sh}"

if [[ ! -f "$SCRIPT_PATH" ]]; then
    # If no file found, try relative to this script
    SCRIPT_PATH="$(cd "$(dirname "$0")/../.." && pwd)/prism-cli-install.sh"
fi

if [[ ! -f "$SCRIPT_PATH" ]]; then
    echo -e "${RED}ERROR:${NC} Cannot find prism-cli-install.sh"
    echo "Usage: $0 [path/to/prism-cli-install.sh]"
    exit 1
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Prism CLI Install Script — Test Suite${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Script: ${DIM}$SCRIPT_PATH${NC}"
echo ""

# Source everything except `main "$@"` at the bottom
# Also strip `set -euo pipefail` so test assertions can handle non-zero exits
SOURCED_SCRIPT="$(mktemp)"
sed -e '$d' -e '/^set -euo pipefail/d' -e '/^set -e/d' "$SCRIPT_PATH" > "$SOURCED_SCRIPT"
source "$SOURCED_SCRIPT"

# Re-establish our own error handling (not -e, we handle errors in assertions)
set +e
set -uo pipefail

# ============================================================================
# TEST SUITE: detect_platform
# ============================================================================

echo -e "${CYAN}▸ detect_platform${NC}"

result=$(detect_platform)
assert_contains "returns os-arch format" "$result" "-"

os_part="${result%%-*}"
arch_part="${result#*-}"

if [[ "$os_part" == "darwin" || "$os_part" == "linux" || "$os_part" == "windows" ]]; then
    pass "OS is valid ($os_part)"
else
    fail "OS is valid" "got '$os_part'"
fi

if [[ "$arch_part" == "amd64" || "$arch_part" == "arm64" ]]; then
    pass "arch is valid ($arch_part)"
else
    fail "arch is valid" "got '$arch_part'"
fi

expected_os=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$expected_os" in
    darwin) assert_contains "matches current OS" "$result" "darwin" ;;
    linux)  assert_contains "matches current OS" "$result" "linux"  ;;
    *)      skip "matches current OS" "unknown OS: $expected_os"     ;;
esac

echo ""

# ============================================================================
# TEST SUITE: is_windows
# ============================================================================

echo -e "${CYAN}▸ is_windows${NC}"

case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        is_windows && pass "returns true on Windows" || fail "returns true on Windows" "returned false"
        ;;
    *)
        is_windows && fail "returns false on non-Windows" "returned true" || pass "returns false on non-Windows"
        ;;
esac

echo ""

# ============================================================================
# TEST SUITE: has_go
# ============================================================================

echo -e "${CYAN}▸ has_go${NC}"

if command -v go &>/dev/null; then
    has_go && pass "returns true when Go installed" || fail "returns true when Go installed" "returned false"
else
    has_go && fail "returns false when Go missing" "returned true" || pass "returns false when Go missing"
fi

echo ""

# ============================================================================
# TEST SUITE: init_workspaces
# ============================================================================

echo -e "${CYAN}▸ init_workspaces${NC}"

sandbox_setup

init_workspaces
assert_dir_exists "creates ~/.prism/bin" "$HOME/.prism/bin"
assert_file_exists "creates workspaces.json" "$HOME/.prism/workspaces.json"

content=$(cat "$HOME/.prism/workspaces.json")
assert_eq "workspaces.json has correct initial content" '{"projects":[]}' "$content"

# Idempotency test
echo '{"projects":["my-app"]}' > "$HOME/.prism/workspaces.json"
init_workspaces
content=$(cat "$HOME/.prism/workspaces.json")
assert_eq "does not overwrite existing workspaces.json" '{"projects":["my-app"]}' "$content"

sandbox_teardown
echo ""

# ============================================================================
# TEST SUITE: setup_path
# ============================================================================

echo -e "${CYAN}▸ setup_path${NC}"

# Test: adds to current PATH
sandbox_setup
mkdir -p "$INSTALL_DIR"
export PATH="${PATH//:$INSTALL_DIR/}"  # remove if present
setup_path
assert_contains "adds INSTALL_DIR to PATH" ":$PATH:" ":$INSTALL_DIR:"
sandbox_teardown

# Test: creates .bashrc when no RC exists
sandbox_setup
mkdir -p "$INSTALL_DIR"
rm -f "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"
setup_path
assert_file_exists "creates .bashrc if none exist" "$HOME/.bashrc"
assert_file_contains ".bashrc contains PATH export" "$HOME/.bashrc" '.prism/bin'
sandbox_teardown

# Test: prefers .zshrc
sandbox_setup
mkdir -p "$INSTALL_DIR"
touch "$HOME/.zshrc"
touch "$HOME/.bashrc"
setup_path
assert_file_contains "prefers .zshrc when present" "$HOME/.zshrc" '.prism/bin'
sandbox_teardown

# Test: idempotent
sandbox_setup
mkdir -p "$INSTALL_DIR"
touch "$HOME/.bashrc"
setup_path
setup_path
count=$(grep -c '.prism/bin' "$HOME/.bashrc")
assert_eq "idempotent — no duplicate PATH entries" "1" "$count"
sandbox_teardown

# Test: falls back to .bash_profile
sandbox_setup
mkdir -p "$INSTALL_DIR"
rm -f "$HOME/.zshrc" "$HOME/.bashrc"
touch "$HOME/.bash_profile"
setup_path
assert_file_contains "falls back to .bash_profile" "$HOME/.bash_profile" '.prism/bin'
sandbox_teardown

echo ""

# ============================================================================
# TEST SUITE: logging helpers
# ============================================================================

echo -e "${CYAN}▸ logging helpers${NC}"

output=$(log "hello world" 2>&1)
assert_contains "log includes prefix" "$output" "[prism-cli]"
assert_contains "log includes message" "$output" "hello world"

output=$(warn "caution" 2>&1)
assert_contains "warn includes prefix" "$output" "[prism-cli]"
assert_contains "warn includes message" "$output" "caution"

output=$(error "broke" 2>&1)
assert_contains "error includes ERROR" "$output" "ERROR"
assert_contains "error includes message" "$output" "broke"

echo ""

# ============================================================================
# TEST SUITE: download_release URL construction
# ============================================================================

echo -e "${CYAN}▸ download_release (URL construction)${NC}"

sandbox_setup
mkdir -p "$INSTALL_DIR"

# Mock curl — in the real script: curl -fsSL "$url" -o "$target"
# Positional: $1=-fsSL $2=url $3=-o $4=target
curl() { echo "CAPTURED_URL=$2"; touch "$4"; chmod +x "$4"; return 0; }
export -f curl

output=$(download_release "linux-amd64" 2>&1)
assert_contains "latest URL for linux-amd64" "$output" "releases/latest/download/prism-cli-linux-amd64"

output=$(download_release "darwin-arm64" "v1.2.3" 2>&1)
assert_contains "versioned URL for darwin-arm64" "$output" "releases/download/v1.2.3/prism-cli-darwin-arm64"

output=$(download_release "windows-amd64" 2>&1)
assert_contains "windows binary has .exe suffix" "$output" "prism-cli-windows-amd64.exe"

unset -f curl
sandbox_teardown
echo ""

# ============================================================================
# TEST SUITE: main (integration)
# ============================================================================

echo -e "${CYAN}▸ main (integration)${NC}"

# Test: rejects unknown method (runs in subshell since main calls exit)
sandbox_setup
mkdir -p "$INSTALL_DIR"
output=$(bash -c '
    source "'"$SOURCED_SCRIPT"'"
    set +e
    main "bogus" 2>&1
' 2>&1) || true
assert_contains "rejects unknown method" "$output" "Usage"
sandbox_teardown

# Test: source fails without Go
sandbox_setup
mkdir -p "$INSTALL_DIR"
output=$(bash -c '
    source "'"$SOURCED_SCRIPT"'"
    set +e
    has_go() { return 1; }
    export -f has_go
    main "source" 2>&1
' 2>&1) || true
assert_contains "source fails without Go" "$output" "Go is required"
sandbox_teardown

# Test: auto fails when no download and no Go
sandbox_setup
mkdir -p "$INSTALL_DIR"
output=$(bash -c '
    export HOME="'"$HOME"'"
    export INSTALL_DIR="'"$INSTALL_DIR"'"
    export PRISM_BIN_DIR="'"$INSTALL_DIR"'"
    source "'"$SOURCED_SCRIPT"'"
    set +e
    download_release() { return 1; }
    has_go() { return 1; }
    export -f download_release has_go
    main "auto" 2>&1
' 2>&1) || true
assert_contains "auto fails gracefully" "$output" "Go is not installed"
sandbox_teardown

# Test: successful install creates full structure
sandbox_setup
mkdir -p "$INSTALL_DIR"
download_release() {
    touch "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    log "Downloaded (mock)"
}
export -f download_release

output=$(main "download" 2>&1)

assert_dir_exists  "creates ~/.prism"               "$HOME/.prism"
assert_dir_exists  "creates ~/.prism/bin"            "$HOME/.prism/bin"
assert_file_exists "creates workspaces.json"         "$HOME/.prism/workspaces.json"
assert_file_executable "binary is executable"        "$HOME/.prism/bin/prism-cli"
assert_contains    "prints completion message"       "$output" "Installation complete"

unset -f download_release
sandbox_teardown

echo ""

# ============================================================================
# TEST SUITE: PRISM_BIN_DIR override
# ============================================================================

echo -e "${CYAN}▸ PRISM_BIN_DIR override${NC}"

sandbox_setup
custom_dir="$HOME/custom-bin"
export PRISM_BIN_DIR="$custom_dir"
export INSTALL_DIR="$custom_dir"
mkdir -p "$custom_dir"

download_release() {
    touch "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
}
export -f download_release

main "download" >/dev/null 2>&1
assert_file_executable "installs to custom PRISM_BIN_DIR" "$custom_dir/prism-cli"

unset -f download_release
sandbox_teardown
echo ""

# ============================================================================
# Summary
# ============================================================================

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}$PASSED passed${NC}  ${RED}$FAILED failed${NC}  ${YELLOW}$SKIPPED skipped${NC}  ${DIM}($TOTAL total)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}Failures:${NC}"
    for e in "${ERRORS[@]}"; do
        echo -e "  ${RED}✗${NC} $e"
    done
fi

echo ""
if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC} 🌈"
    exit 0
else
    echo -e "${RED}$FAILED test(s) failed.${NC}"
    exit 1
fi
