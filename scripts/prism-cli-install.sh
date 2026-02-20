#!/usr/bin/env bash
# Prism CLI Installer
# Downloads or builds prism-cli binary, configures shell PATH, and initializes global ~/.prism/
#
# Usage:
#   bash prism-cli-install.sh [auto|source|download]
#   curl -fsSL https://raw.githubusercontent.com/TheDigitalGriot/prism-plugin/main/scripts/prism-cli-install.sh | bash

set -euo pipefail

REPO="TheDigitalGriot/prism-plugin"
BINARY_NAME="prism-cli"
INSTALL_DIR="${PRISM_BIN_DIR:-$HOME/.prism/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[prism-cli]${NC} $*"; }
warn() { echo -e "${YELLOW}[prism-cli]${NC} $*"; }
error() { echo -e "${RED}[prism-cli]${NC} ERROR: $*" >&2; }

# Detect platform
detect_platform() {
    local os arch
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)

    case "$os" in
        darwin) os="darwin" ;;
        linux) os="linux" ;;
        mingw*|msys*|cygwin*) os="windows" ;;
        *) error "Unsupported OS: $os"; exit 1 ;;
    esac

    case "$arch" in
        x86_64|amd64) arch="amd64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) error "Unsupported architecture: $arch"; exit 1 ;;
    esac

    echo "${os}-${arch}"
}

# Check if running on Windows (Git Bash / MSYS / Cygwin)
is_windows() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) return 0 ;;
        *) return 1 ;;
    esac
}

# Check if Go is installed
has_go() {
    command -v go &> /dev/null
}

# Build from source
build_from_source() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local source_dir="$script_dir/../cmd/prism-cli"

    if [[ ! -d "$source_dir" ]]; then
        error "Source directory not found: $source_dir"
        return 1
    fi

    log "Building from source..."
    cd "$source_dir"

    local ext=""
    is_windows && ext=".exe"

    local ldversion
    ldversion=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
    go build -ldflags "-X main.version=${ldversion}" -o "${INSTALL_DIR}/${BINARY_NAME}${ext}" .
    log "Built successfully: ${INSTALL_DIR}/${BINARY_NAME}${ext}"
}

# Download pre-built binary from GitHub releases
download_release() {
    local platform="$1"
    local version="${2:-latest}"

    local ext=""
    [[ "$platform" == windows-* ]] && ext=".exe"

    local binary_name="${BINARY_NAME}-${platform}${ext}"
    local url

    if [[ "$version" == "latest" ]]; then
        url="https://github.com/${REPO}/releases/latest/download/${binary_name}"
    else
        url="https://github.com/${REPO}/releases/download/${version}/${binary_name}"
    fi

    log "Downloading $binary_name..."

    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "${INSTALL_DIR}/${BINARY_NAME}${ext}"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "${INSTALL_DIR}/${BINARY_NAME}${ext}"
    else
        error "Neither curl nor wget found"
        return 1
    fi

    chmod +x "${INSTALL_DIR}/${BINARY_NAME}${ext}"
    log "Downloaded to: ${INSTALL_DIR}/${BINARY_NAME}${ext}"
}

# Configure PATH in shell profiles
setup_path() {
    # Add to current session
    export PATH="$PATH:$INSTALL_DIR"

    # Find bash/zsh profile to update
    local rc_file=""
    if [[ -f "$HOME/.zshrc" ]]; then
        rc_file="$HOME/.zshrc"
    elif [[ -f "$HOME/.bashrc" ]]; then
        rc_file="$HOME/.bashrc"
    elif [[ -f "$HOME/.bash_profile" ]]; then
        rc_file="$HOME/.bash_profile"
    else
        # Create .bashrc if nothing exists
        rc_file="$HOME/.bashrc"
        touch "$rc_file"
    fi

    # Update bash/zsh profile
    if ! grep -q '.prism/bin' "$rc_file" 2>/dev/null; then
        echo '' >> "$rc_file"
        echo '# Prism CLI' >> "$rc_file"
        echo 'export PATH="$PATH:$HOME/.prism/bin"' >> "$rc_file"
        log "Updated $rc_file"
    else
        log "$rc_file already configured"
    fi

    # On Windows: also configure PowerShell
    if is_windows; then
        setup_powershell_path
    fi
}

# Configure PowerShell $PROFILE on Windows
setup_powershell_path() {
    local pwsh_cmd=""
    pwsh_cmd=$(command -v pwsh.exe 2>/dev/null || command -v powershell.exe 2>/dev/null || true)

    if [[ -z "$pwsh_cmd" ]]; then
        warn "PowerShell not found — skipping PowerShell PATH setup"
        return
    fi

    # Get PowerShell profile path
    local pwsh_profile
    pwsh_profile=$("$pwsh_cmd" -NoProfile -Command 'echo $PROFILE' 2>/dev/null | tr -d '\r')

    if [[ -z "$pwsh_profile" ]]; then
        warn "Could not determine PowerShell profile path"
        return
    fi

    # Convert to Unix path for bash file operations
    local pwsh_profile_unix
    pwsh_profile_unix=$(cygpath -u "$pwsh_profile" 2>/dev/null || echo "$pwsh_profile")

    # Check if already configured
    if grep -q '.prism' "$pwsh_profile_unix" 2>/dev/null; then
        log "PowerShell profile already configured"
        return
    fi

    # Create profile directory and file if needed
    mkdir -p "$(dirname "$pwsh_profile_unix")"
    touch "$pwsh_profile_unix"

    # Write PATH entry (single quotes keep $env vars literal in bash)
    echo '' >> "$pwsh_profile_unix"
    echo '# Prism CLI' >> "$pwsh_profile_unix"
    echo '$env:Path += ";$env:USERPROFILE\.prism\bin"' >> "$pwsh_profile_unix"
    log "Updated PowerShell profile: $pwsh_profile"
}

# Initialize global ~/.prism/ directory and workspaces.json
init_workspaces() {
    local prism_home="$HOME/.prism"
    mkdir -p "$prism_home/bin"

    if [[ ! -f "$prism_home/workspaces.json" ]]; then
        echo '{"projects":[]}' > "$prism_home/workspaces.json"
        log "Created $prism_home/workspaces.json"
    fi

    # Windows: ensure USERPROFILE path is consistent
    if is_windows && [[ -n "${USERPROFILE:-}" ]] && [[ "$HOME" != "$USERPROFILE" ]]; then
        local prism_home_win="$USERPROFILE/.prism"
        mkdir -p "$prism_home_win/bin"
        if [[ ! -f "$prism_home_win/workspaces.json" ]]; then
            cp "$prism_home/workspaces.json" "$prism_home_win/workspaces.json" 2>/dev/null || true
        fi
    fi
}

# Main installation
main() {
    local method="${1:-auto}"

    log "Prism CLI Installer"
    log ""

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    case "$method" in
        source)
            if ! has_go; then
                error "Go is required for source installation"
                exit 1
            fi
            build_from_source
            ;;
        download)
            local platform
            platform=$(detect_platform)
            download_release "$platform"
            ;;
        auto)
            # Try download first, fall back to source
            local platform
            platform=$(detect_platform)

            if download_release "$platform" 2>/dev/null; then
                log "Installed from pre-built release"
            elif has_go; then
                warn "No pre-built release found, building from source..."
                build_from_source
            else
                error "No pre-built binary available and Go is not installed"
                error "Install Go from https://go.dev or wait for a release"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 [auto|source|download]"
            exit 1
            ;;
    esac

    # Configure PATH in shell profiles
    setup_path

    # Initialize workspaces registry
    init_workspaces

    # Verify installation
    local ext=""
    is_windows && ext=".exe"

    if [[ -x "${INSTALL_DIR}/${BINARY_NAME}${ext}" ]]; then
        log ""
        log "Installation complete!"
        log ""
        log "  Binary:      ${INSTALL_DIR}/${BINARY_NAME}${ext}"
        log "  PATH:        Configured in shell profiles"
        log "  Registry:    ~/.prism/workspaces.json initialized"
        log ""
        log "  Open a new terminal, then run: prism-cli --version"
    else
        error "Installation failed"
        exit 1
    fi
}

main "$@"
