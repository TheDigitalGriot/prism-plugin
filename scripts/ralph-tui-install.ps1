# Ralph TUI Installer for Windows
# Downloads or builds ralph-tui binary

param(
    [string]$Method = "auto"
)

$ErrorActionPreference = "Stop"

$Repo = "TheDigitalGriot/prism-plugin"
$BinaryName = "ralph-tui"
$InstallDir = if ($env:PRISM_BIN_DIR) { $env:PRISM_BIN_DIR } else { "$env:USERPROFILE\.prism\bin" }

function Write-Log { param($Message) Write-Host "[ralph-tui] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[ralph-tui] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ralph-tui] ERROR: $Message" -ForegroundColor Red }

function Test-GoInstalled {
    try {
        $null = Get-Command go -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Build-FromSource {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SourceDir = Join-Path (Split-Path -Parent $ScriptDir) "cmd\ralph-tui"

    if (-not (Test-Path $SourceDir)) {
        Write-Err "Source directory not found: $SourceDir"
        exit 1
    }

    Write-Log "Building from source..."
    Push-Location $SourceDir
    try {
        go build -o "$InstallDir\$BinaryName.exe" .
        Write-Log "Built successfully: $InstallDir\$BinaryName.exe"
    } finally {
        Pop-Location
    }
}

function Get-Release {
    param([string]$Version = "latest")

    $BinaryFile = "$BinaryName-windows-amd64.exe"

    if ($Version -eq "latest") {
        $Url = "https://github.com/$Repo/releases/latest/download/$BinaryFile"
    } else {
        $Url = "https://github.com/$Repo/releases/download/$Version/$BinaryFile"
    }

    Write-Log "Downloading from $Url..."

    try {
        Invoke-WebRequest -Uri $Url -OutFile "$InstallDir\$BinaryName.exe" -UseBasicParsing
        Write-Log "Downloaded to: $InstallDir\$BinaryName.exe"
    } catch {
        Write-Err "Download failed: $_"
        return $false
    }
    return $true
}

# Main
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

switch ($Method) {
    "source" {
        if (-not (Test-GoInstalled)) {
            Write-Err "Go is required for source installation"
            exit 1
        }
        Build-FromSource
    }
    "download" {
        if (-not (Get-Release)) { exit 1 }
    }
    "auto" {
        if (Get-Release) {
            Write-Log "Installed from pre-built release"
        } elseif (Test-GoInstalled) {
            Write-Warn "No pre-built release found, building from source..."
            Build-FromSource
        } else {
            Write-Err "No pre-built binary available and Go is not installed"
            Write-Err "Install Go from https://go.dev or wait for a release"
            exit 1
        }
    }
    default {
        Write-Host "Usage: .\ralph-tui-install.ps1 [-Method auto|source|download]"
        exit 1
    }
}

# Verify installation
if (Test-Path "$InstallDir\$BinaryName.exe") {
    Write-Log "Installation complete!"
    Write-Log ""
    Write-Log "Add to PATH:"
    Write-Log "  `$env:PATH += `";$InstallDir`""
    Write-Log ""
    Write-Log "Or add permanently via System Properties > Environment Variables"
    Write-Log ""
    Write-Log "Run: ralph-tui --help"
} else {
    Write-Err "Installation failed"
    exit 1
}
