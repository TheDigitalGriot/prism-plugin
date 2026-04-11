# Prism CLI Installer for Windows (PowerShell)
# Downloads or builds prism-cli binary, configures PATH, and initializes global ~/.prism/
#
# Usage:
#   .\prism-cli-install.ps1 [-Method auto|source|download]
#   irm https://raw.githubusercontent.com/TheDigitalGriot/prism-plugin/main/scripts/prism-cli-install.ps1 | iex

param(
    [string]$Method = "auto"
)

$ErrorActionPreference = "Stop"

$Repo = "TheDigitalGriot/prism-plugin"
$BinaryName = "prism-cli"
$InstallDir = if ($env:PRISM_BIN_DIR) { $env:PRISM_BIN_DIR } else { "$env:USERPROFILE\.prism\bin" }

function Write-Log { param($Message) Write-Host "[prism-cli] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[prism-cli] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[prism-cli] ERROR: $Message" -ForegroundColor Red }

function Test-GoInstalled {
    try {
        $null = Get-Command go -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Build-FromSource {
    $ScriptDir = if ($MyInvocation.PSCommandPath) { Split-Path -Parent $MyInvocation.PSCommandPath } else { $null }

    if (-not $ScriptDir) {
        Write-Err "Source directory not available (running via pipe). Use -Method download"
        return
    }

    $SourceDir = Join-Path (Split-Path -Parent $ScriptDir) "cmd\prism-cli"

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

    Write-Log "Downloading $BinaryFile..."

    try {
        Invoke-WebRequest -Uri $Url -OutFile "$InstallDir\$BinaryName.exe" -UseBasicParsing
        Write-Log "Downloaded to: $InstallDir\$BinaryName.exe"
    } catch {
        Write-Err "Download failed: $_"
        return $false
    }
    return $true
}

function Set-PathProfile {
    $PrismBin = "$env:USERPROFILE\.prism\bin"

    # Add to current session
    if ($env:Path -notlike "*$PrismBin*") {
        $env:Path += ";$PrismBin"
        Write-Log "Added to current session PATH"
    }

    # Add to PowerShell $PROFILE
    $ProfilePath = $PROFILE
    if ($ProfilePath) {
        $ProfileDir = Split-Path -Parent $ProfilePath
        if (-not (Test-Path $ProfileDir)) {
            New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
        }
        if (-not (Test-Path $ProfilePath)) {
            New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
        }

        $Content = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
        if (-not $Content -or $Content -notlike "*\.prism\bin*") {
            Add-Content -Path $ProfilePath -Value "`n# Prism CLI`n`$env:Path += `";`$env:USERPROFILE\.prism\bin`""
            Write-Log "Updated PowerShell profile: $ProfilePath"
        } else {
            Write-Log "PowerShell profile already configured"
        }
    }
}

function Initialize-Workspaces {
    $PrismHome = "$env:USERPROFILE\.prism"
    $WsFile = "$PrismHome\workspaces.json"

    if (-not (Test-Path $PrismHome)) {
        New-Item -ItemType Directory -Path $PrismHome -Force | Out-Null
    }

    if (-not (Test-Path $WsFile)) {
        '{"projects":[]}' | Set-Content -Path $WsFile -Encoding UTF8
        Write-Log "Created $WsFile"
    } else {
        Write-Log "Workspace registry already exists"
    }
}

# Main
Write-Log "Prism CLI Installer (PowerShell)"
Write-Log ""

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
        Write-Host "Usage: .\prism-cli-install.ps1 [-Method auto|source|download]"
        exit 1
    }
}

# Configure PATH
Set-PathProfile

# Initialize workspaces registry
Initialize-Workspaces

# Verify installation
if (Test-Path "$InstallDir\$BinaryName.exe") {
    Write-Log ""
    Write-Log "Installation complete!"
    Write-Log ""
    Write-Log "  Binary:      $InstallDir\$BinaryName.exe"
    Write-Log "  PATH:        Configured in PowerShell profile"
    Write-Log "  Registry:    $env:USERPROFILE\.prism\workspaces.json initialized"
    Write-Log ""
    Write-Log "  Run: prism-cli --version"
} else {
    Write-Err "Installation failed"
    exit 1
}
