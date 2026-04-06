#!/usr/bin/env bats
# ============================================================================
# prism-cli-install.bats — BATS tests for prism-cli-install.sh
# ============================================================================
# Install BATS: brew install bats-core  (or)  npm install -g bats
#
# Run:
#   bats scripts/tests/prism-cli-install.bats
#
# Requires bats-core, bats-support, and bats-assert:
#   brew install bats-core
#   git clone https://github.com/bats-core/bats-support test/bats-support
#   git clone https://github.com/bats-core/bats-assert test/bats-assert
# ============================================================================

# --- Test helpers -----------------------------------------------------------

setup() {
    # Create isolated temp HOME so tests don't touch real dotfiles
    export ORIG_HOME="$HOME"
    export HOME="$(mktemp -d)"
    export TEST_INSTALL_DIR="$HOME/.prism/bin"
    export PRISM_BIN_DIR="$TEST_INSTALL_DIR"

    # Path to the script under test (adjust relative to your repo root)
    SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../" && pwd)"
    INSTALL_SCRIPT="$SCRIPT_DIR/scripts/prism-cli-install.sh"

    # Source just the functions (not main) for unit testing
    # We'll create a sourceable version that skips the `main "$@"` call
    export INSTALL_SCRIPT_SOURCED="$HOME/_install_sourced.sh"
    sed '$d' "$INSTALL_SCRIPT" > "$INSTALL_SCRIPT_SOURCED"  # strip last line (main "$@")
    source "$INSTALL_SCRIPT_SOURCED"
}

teardown() {
    # Clean up temp HOME
    rm -rf "$HOME"
    export HOME="$ORIG_HOME"
}

# --- detect_platform --------------------------------------------------------

@test "detect_platform returns os-arch format" {
    local result
    result=$(detect_platform)
    [[ "$result" =~ ^(darwin|linux|windows)-(amd64|arm64)$ ]]
}

@test "detect_platform identifies darwin on macOS" {
    if [[ "$(uname -s)" != "Darwin" ]]; then
        skip "Not running on macOS"
    fi
    local result
    result=$(detect_platform)
    [[ "$result" == darwin-* ]]
}

@test "detect_platform identifies linux on Linux" {
    if [[ "$(uname -s)" != "Linux" ]]; then
        skip "Not running on Linux"
    fi
    local result
    result=$(detect_platform)
    [[ "$result" == linux-* ]]
}

@test "detect_platform includes valid architecture" {
    local result
    result=$(detect_platform)
    local arch="${result#*-}"
    [[ "$arch" == "amd64" || "$arch" == "arm64" ]]
}

# --- is_windows -------------------------------------------------------------

@test "is_windows returns false on non-Windows" {
    if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
        skip "Running on Windows"
    fi
    run is_windows
    [ "$status" -ne 0 ]
}

# --- has_go -----------------------------------------------------------------

@test "has_go returns 0 when Go is installed" {
    if ! command -v go &>/dev/null; then
        skip "Go not installed"
    fi
    run has_go
    [ "$status" -eq 0 ]
}

@test "has_go returns non-zero when Go is missing" {
    # Temporarily hide go from PATH
    local orig_path="$PATH"
    export PATH="/usr/bin:/bin"
    if command -v go &>/dev/null; then
        skip "go is in /usr/bin or /bin"
    fi
    run has_go
    [ "$status" -ne 0 ]
    export PATH="$orig_path"
}

# --- init_workspaces --------------------------------------------------------

@test "init_workspaces creates ~/.prism/bin directory" {
    init_workspaces
    [ -d "$HOME/.prism/bin" ]
}

@test "init_workspaces creates workspaces.json" {
    init_workspaces
    [ -f "$HOME/.prism/workspaces.json" ]
}

@test "init_workspaces writes valid JSON to workspaces.json" {
    init_workspaces
    local content
    content=$(cat "$HOME/.prism/workspaces.json")
    [ "$content" = '{"projects":[]}' ]
}

@test "init_workspaces is idempotent — does not overwrite existing workspaces.json" {
    # First call creates it
    init_workspaces

    # Write custom content
    echo '{"projects":["my-app"]}' > "$HOME/.prism/workspaces.json"

    # Second call should NOT overwrite
    init_workspaces

    local content
    content=$(cat "$HOME/.prism/workspaces.json")
    [ "$content" = '{"projects":["my-app"]}' ]
}

# --- setup_path -------------------------------------------------------------

@test "setup_path adds INSTALL_DIR to current PATH" {
    # Remove it first if present
    export PATH="${PATH//:$INSTALL_DIR/}"
    setup_path
    [[ ":$PATH:" == *":$INSTALL_DIR:"* ]]
}

@test "setup_path creates .bashrc if no shell RC exists" {
    # Ensure no RC files exist in temp HOME
    rm -f "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"
    setup_path
    [ -f "$HOME/.bashrc" ]
}

@test "setup_path writes PATH export to .bashrc" {
    rm -f "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"
    setup_path
    grep -q '.prism/bin' "$HOME/.bashrc"
}

@test "setup_path prefers .zshrc when it exists" {
    touch "$HOME/.zshrc"
    touch "$HOME/.bashrc"
    setup_path
    grep -q '.prism/bin' "$HOME/.zshrc"
}

@test "setup_path is idempotent — does not duplicate PATH entries" {
    touch "$HOME/.bashrc"
    setup_path
    setup_path  # Call twice
    local count
    count=$(grep -c '.prism/bin' "$HOME/.bashrc")
    [ "$count" -eq 1 ]
}

@test "setup_path prefers .bashrc over .bash_profile" {
    touch "$HOME/.bashrc"
    touch "$HOME/.bash_profile"
    # Remove .zshrc so it doesn't take priority
    rm -f "$HOME/.zshrc"
    setup_path
    grep -q '.prism/bin' "$HOME/.bashrc"
}

@test "setup_path falls back to .bash_profile when no .bashrc or .zshrc" {
    rm -f "$HOME/.zshrc" "$HOME/.bashrc"
    touch "$HOME/.bash_profile"
    setup_path
    grep -q '.prism/bin' "$HOME/.bash_profile"
}

# --- Color/logging helpers --------------------------------------------------

@test "log outputs green prefixed message" {
    run log "hello world"
    [[ "$output" == *"[prism-cli]"* ]]
    [[ "$output" == *"hello world"* ]]
}

@test "warn outputs yellow prefixed message" {
    run warn "be careful"
    [[ "$output" == *"[prism-cli]"* ]]
    [[ "$output" == *"be careful"* ]]
}

@test "error outputs to stderr" {
    run error "something broke"
    [[ "$output" == *"ERROR"* ]]
    [[ "$output" == *"something broke"* ]]
}

# --- build_from_source ------------------------------------------------------

@test "build_from_source fails when source dir is missing" {
    # Source the script in a context where BASH_SOURCE points nowhere useful
    export BASH_SOURCE=("/nonexistent/path/install.sh")
    run build_from_source
    [ "$status" -ne 0 ]
}

# --- download_release -------------------------------------------------------

@test "download_release constructs correct latest URL" {
    # We can't actually download, but we can test the URL construction
    # by mocking curl to just echo what it receives
    curl() { echo "URL: $4"; return 0; }
    export -f curl
    mkdir -p "$INSTALL_DIR"

    run download_release "linux-amd64"
    [[ "$output" == *"https://github.com/TheDigitalGriot/prism-plugin/releases/latest/download/prism-cli-linux-amd64"* ]]

    unset -f curl
}

@test "download_release constructs correct versioned URL" {
    curl() { echo "URL: $4"; return 0; }
    export -f curl
    mkdir -p "$INSTALL_DIR"

    run download_release "darwin-arm64" "v1.2.3"
    [[ "$output" == *"https://github.com/TheDigitalGriot/prism-plugin/releases/download/v1.2.3/prism-cli-darwin-arm64"* ]]

    unset -f curl
}

@test "download_release adds .exe suffix for windows" {
    curl() { echo "URL: $4"; return 0; }
    export -f curl
    mkdir -p "$INSTALL_DIR"

    run download_release "windows-amd64"
    [[ "$output" == *"prism-cli-windows-amd64.exe"* ]]

    unset -f curl
}

@test "download_release fails when neither curl nor wget available" {
    # Hide both
    curl() { return 127; }
    wget() { return 127; }
    command() {
        if [[ "$2" == "curl" || "$2" == "wget" ]]; then return 1; fi
        builtin command "$@"
    }
    export -f curl wget command
    mkdir -p "$INSTALL_DIR"

    run download_release "linux-amd64"
    [ "$status" -ne 0 ]

    unset -f curl wget command
}

# --- main (integration-style) ----------------------------------------------

@test "main rejects unknown install method" {
    run main "bogus"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Usage"* ]]
}

@test "main 'source' fails without Go" {
    # Temporarily hide Go
    has_go() { return 1; }
    export -f has_go

    run main "source"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Go is required"* ]]

    unset -f has_go
}

@test "main creates INSTALL_DIR" {
    rm -rf "$INSTALL_DIR"

    # Mock download_release to create a fake binary
    download_release() {
        touch "${INSTALL_DIR}/${BINARY_NAME}"
        chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    }
    export -f download_release

    main "download"
    [ -d "$INSTALL_DIR" ]

    unset -f download_release
}

@test "main 'auto' falls back to source when download fails and Go exists" {
    local call_log="$HOME/call_log.txt"
    echo "" > "$call_log"

    download_release() { echo "download_called" >> "$call_log"; return 1; }
    has_go() { return 0; }
    build_from_source() {
        echo "build_called" >> "$call_log"
        touch "${INSTALL_DIR}/${BINARY_NAME}"
        chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    }
    export -f download_release has_go build_from_source

    main "auto"

    grep -q "download_called" "$call_log"
    grep -q "build_called" "$call_log"

    unset -f download_release has_go build_from_source
}

@test "main 'auto' fails when download fails and no Go" {
    download_release() { return 1; }
    has_go() { return 1; }
    export -f download_release has_go

    run main "auto"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Go is not installed"* ]]

    unset -f download_release has_go
}

@test "main prints success message on completion" {
    download_release() {
        touch "${INSTALL_DIR}/${BINARY_NAME}"
        chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    }
    export -f download_release

    run main "download"
    [[ "$output" == *"Installation complete"* ]]

    unset -f download_release
}

# --- End-to-end install simulation ------------------------------------------

@test "full install simulation creates expected file tree" {
    # Mock the download to create a fake binary
    download_release() {
        touch "${INSTALL_DIR}/${BINARY_NAME}"
        chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    }
    export -f download_release

    main "download"

    # Assert directory structure
    [ -d "$HOME/.prism" ]
    [ -d "$HOME/.prism/bin" ]
    [ -f "$HOME/.prism/workspaces.json" ]
    [ -x "$HOME/.prism/bin/prism-cli" ]

    # Assert PATH is configured
    [[ ":$PATH:" == *":$HOME/.prism/bin:"* ]]

    # Assert shell RC was updated
    local rc_found=false
    for f in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
        if [[ -f "$f" ]] && grep -q '.prism/bin' "$f"; then
            rc_found=true
            break
        fi
    done
    [ "$rc_found" = true ]

    unset -f download_release
}
