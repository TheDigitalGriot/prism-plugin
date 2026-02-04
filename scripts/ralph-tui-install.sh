#!/usr/bin/env bash
# Ralph TUI Installer
# Downloads or builds ralph-tui binary for the current platform

set -euo pipefail

REPO="TheDigitalGriot/prism-plugin"
BINARY_NAME="ralph-tui"
INSTALL_DIR="${PRISM_BIN_DIR:-$HOME/.prism/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ralph-tui]${NC} $*"; }
warn() { echo -e "${YELLOW}[ralph-tui]${NC} $*"; }
error() { echo -e "${RED}[ralph-tui]${NC} ERROR: $*" >&2; }

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

# Check if Go is installed
has_go() {
    command -v go &> /dev/null
}

# Build from source
build_from_source() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local source_dir="$script_dir/../cmd/ralph-tui"

    if [[ ! -d "$source_dir" ]]; then
        error "Source directory not found: $source_dir"
        return 1
    fi

    log "Building from source..."
    cd "$source_dir"

    local ext=""
    [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]] && ext=".exe"

    go build -o "${INSTALL_DIR}/${BINARY_NAME}${ext}" .
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

    log "Downloading $binary_name from $url..."

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

# Main installation
main() {
    local method="${1:-auto}"

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

    # Verify installation
    local ext=""
    [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]] && ext=".exe"

    if [[ -x "${INSTALL_DIR}/${BINARY_NAME}${ext}" ]]; then
        log "Installation complete!"
        log ""
        log "Add to PATH (if not already):"
        log "  export PATH=\"\$PATH:$INSTALL_DIR\""
        log ""
        log "Or create an alias:"
        log "  alias ralph-tui=\"${INSTALL_DIR}/${BINARY_NAME}${ext}\""
        log ""
        log "Run: ralph-tui --help"
    else
        error "Installation failed"
        exit 1
    fi
}

main "$@"
