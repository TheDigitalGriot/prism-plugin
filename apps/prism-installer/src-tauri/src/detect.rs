use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

// ─── Enriched Data Model ───────────────────────────────────────────────────────

/// How a tool was installed on the system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InstallMethod {
    /// InnoSetup installer in Program Files (system-wide)
    SystemInstall,
    /// Per-user install in %LOCALAPPDATA%\Programs or ~/Applications
    UserInstall,
    /// Squirrel/auto-update style in %LOCALAPPDATA%
    SquirrelInstall,
    /// Global npm package
    NpmGlobal,
    /// Unknown / manual install
    Unknown,
}

/// Rich detection result for a single dev tool (editor or CLI).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedTool {
    pub name: String,
    pub version: Option<String>,
    pub executable: Option<PathBuf>,
    pub install_location: Option<PathBuf>,
    pub install_method: InstallMethod,
    pub cli_available: bool,
    pub metadata: HashMap<String, String>,
}

/// Full detection report returned by `detect_all_tools`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionReport {
    pub editors: Vec<DetectedTool>,
    pub claude_code: Option<DetectedTool>,
    pub node_available: bool,
    pub npm_prefix: Option<PathBuf>,
}

// ─── Legacy type — kept for backward compat with install_extension.rs ──────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub cmd_path: String,
}

impl From<&EditorInfo> for DetectedTool {
    fn from(e: &EditorInfo) -> Self {
        let mut metadata = HashMap::new();
        metadata.insert("id".to_string(), e.id.clone());
        metadata.insert("cli_path".to_string(), e.cmd_path.clone());
        DetectedTool {
            name: e.name.clone(),
            version: None,
            executable: Some(PathBuf::from(&e.cmd_path)),
            install_location: Some(PathBuf::from(&e.path)),
            install_method: InstallMethod::Unknown,
            cli_available: true,
            metadata,
        }
    }
}

// ─── OS and Disk types ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
    pub arch: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub available_bytes: u64,
    pub available_mb: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PrismInstallInfo {
    pub install_dir: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreflightResult {
    pub editors: Vec<DetectedTool>,
    pub claude_code: Option<DetectedTool>,
    pub existing_prism: Option<PrismInstallInfo>,
    pub os_info: OsInfo,
    pub disk_info: DiskInfo,
}

// ─── Editor Configuration ──────────────────────────────────────────────────────

struct EditorConfig {
    id: &'static str,
    name: &'static str,
    exe_name: &'static str,
    cli_name: &'static str,
    registry_match: &'static str,
    windows_dir: &'static str,
    #[cfg(target_os = "macos")]
    macos_app: &'static str,
}

fn get_editor_configs() -> Vec<EditorConfig> {
    vec![
        EditorConfig {
            id: "vscode",
            name: "VS Code",
            exe_name: "Code.exe",
            cli_name: "code",
            registry_match: "Visual Studio Code",
            windows_dir: "Microsoft VS Code",
            #[cfg(target_os = "macos")]
            macos_app: "Visual Studio Code.app",
        },
        EditorConfig {
            id: "cursor",
            name: "Cursor",
            exe_name: "Cursor.exe",
            cli_name: "cursor",
            registry_match: "Cursor",
            windows_dir: "cursor",
            #[cfg(target_os = "macos")]
            macos_app: "Cursor.app",
        },
        EditorConfig {
            id: "windsurf",
            name: "Windsurf",
            exe_name: "Windsurf.exe",
            cli_name: "windsurf",
            registry_match: "Windsurf",
            windows_dir: "windsurf",
            #[cfg(target_os = "macos")]
            macos_app: "Windsurf.app",
        },
    ]
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

/// Locate a command on PATH (via `where.exe` on Windows, `which` on macOS).
fn which_command(name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let output = Command::new("where.exe").arg(name).output().ok()?;
    #[cfg(not(target_os = "windows"))]
    let output = Command::new("which").arg(name).output().ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.lines().next().map(|line| PathBuf::from(line.trim()))
    } else {
        None
    }
}

/// Run a command and return its stdout (trimmed).
fn get_command_output(cmd: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(cmd).args(args).output().ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// Get the npm global prefix directory.
fn get_npm_prefix() -> Option<PathBuf> {
    let output = get_command_output("npm", &["config", "get", "prefix"])?;
    let path = PathBuf::from(&output);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Read version from `resources/app/package.json` inside an editor install root.
fn read_version_from_package_json(base_path: &Path) -> Option<String> {
    let pkg_path = base_path
        .join("resources")
        .join("app")
        .join("package.json");
    let content = std::fs::read_to_string(pkg_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("version")
        .and_then(|v| v.as_str())
        .map(String::from)
}

/// Find CLI shim inside an editor install root.
/// VS Code uses `bin/code.cmd`, Cursor/Windsurf use `resources/app/bin/{name}.cmd`.
fn find_cli_in_install(install_root: &Path, cli_name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let cli_file = format!("{}.cmd", cli_name);
    #[cfg(not(target_os = "windows"))]
    let cli_file = cli_name.to_string();

    // Try resources/app/bin/ first (Cursor, Windsurf)
    let deep = install_root
        .join("resources")
        .join("app")
        .join("bin")
        .join(&cli_file);
    if deep.exists() {
        return Some(deep);
    }

    // Try bin/ (VS Code)
    let shallow = install_root.join("bin").join(&cli_file);
    if shallow.exists() {
        return Some(shallow);
    }

    None
}

// ─── Windows Editor Detection ──────────────────────────────────────────────────

/// Tier 1: Scan Windows registry Uninstall keys for a matching editor.
#[cfg(target_os = "windows")]
fn detect_editor_from_registry(config: &EditorConfig) -> Option<DetectedTool> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hives: &[(winreg::HKEY, &str)] = &[
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_CURRENT_USER,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];

    let match_lower = config.registry_match.to_ascii_lowercase();

    for (hive, path) in hives {
        let Ok(uninstall_key) =
            RegKey::predef(*hive).open_subkey_with_flags(path, KEY_READ)
        else {
            continue;
        };

        for subkey_name in uninstall_key.enum_keys().filter_map(Result::ok) {
            let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) else {
                continue;
            };

            let display_name: String = subkey.get_value("DisplayName").unwrap_or_default();
            if !display_name.to_ascii_lowercase().contains(&match_lower) {
                continue;
            }

            let install_location: String =
                subkey.get_value("InstallLocation").unwrap_or_default();
            let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
            let publisher: String = subkey.get_value("Publisher").unwrap_or_default();

            let install_path = PathBuf::from(&install_location);
            let exe_path = install_path.join(config.exe_name);

            let method = if install_location.contains("Program Files") {
                InstallMethod::SystemInstall
            } else if install_location.contains("AppData\\Local\\Programs") {
                InstallMethod::UserInstall
            } else if install_location.contains("AppData\\Local") {
                InstallMethod::SquirrelInstall
            } else {
                InstallMethod::Unknown
            };

            let cli_path = find_cli_in_install(&install_path, config.cli_name);

            let mut metadata = HashMap::new();
            metadata.insert("id".into(), config.id.into());
            metadata.insert("publisher".into(), publisher);
            metadata.insert("registry_key".into(), subkey_name);
            metadata.insert("detection_method".into(), "registry".into());
            if let Some(ref cli) = cli_path {
                metadata.insert("cli_path".into(), cli.to_string_lossy().into());
            }

            return Some(DetectedTool {
                name: config.name.into(),
                version: if version.is_empty() {
                    None
                } else {
                    Some(version)
                },
                executable: if exe_path.exists() {
                    Some(exe_path)
                } else {
                    None
                },
                install_location: if install_path.exists() {
                    Some(install_path)
                } else {
                    None
                },
                install_method: method,
                cli_available: cli_path.is_some(),
                metadata,
            });
        }
    }

    None
}

/// Get all known filesystem candidate paths for an editor on Windows.
#[cfg(target_os = "windows")]
fn get_editor_candidate_paths(config: &EditorConfig) -> Vec<(PathBuf, InstallMethod)> {
    let mut paths = Vec::new();

    // System-wide (Program Files)
    paths.push((
        PathBuf::from(r"C:\Program Files").join(config.windows_dir),
        InstallMethod::SystemInstall,
    ));

    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        // Per-user install (%LOCALAPPDATA%\Programs\...)
        paths.push((
            PathBuf::from(&local).join("Programs").join(config.windows_dir),
            InstallMethod::UserInstall,
        ));

        // Squirrel-style for Cursor (%LOCALAPPDATA%\cursor\app-X.Y.Z)
        if config.id == "cursor" {
            let squirrel_base = PathBuf::from(&local).join("cursor");
            if squirrel_base.join("Update.exe").exists() {
                if let Ok(entries) = std::fs::read_dir(&squirrel_base) {
                    let mut app_dirs: Vec<PathBuf> = entries
                        .filter_map(Result::ok)
                        .map(|e| e.path())
                        .filter(|p| {
                            p.is_dir()
                                && p.file_name()
                                    .map(|n| n.to_string_lossy().starts_with("app-"))
                                    .unwrap_or(false)
                        })
                        .collect();
                    // Sort descending so newest version is first
                    app_dirs.sort_by(|a, b| b.cmp(a));
                    if let Some(latest) = app_dirs.first() {
                        paths.push((latest.clone(), InstallMethod::SquirrelInstall));
                    }
                }
            }
        }
    }

    paths
}

/// Tier 2: Check known filesystem locations for an editor on Windows.
#[cfg(target_os = "windows")]
fn detect_editor_from_filesystem(config: &EditorConfig) -> Option<DetectedTool> {
    let candidates = get_editor_candidate_paths(config);

    for (base_path, method) in candidates {
        let exe_path = base_path.join(config.exe_name);
        if !exe_path.exists() {
            continue;
        }

        let cli_path = find_cli_in_install(&base_path, config.cli_name);
        let version = read_version_from_package_json(&base_path);

        let mut metadata = HashMap::new();
        metadata.insert("id".into(), config.id.into());
        metadata.insert("detection_method".into(), "filesystem".into());
        if let Some(ref cli) = cli_path {
            metadata.insert("cli_path".into(), cli.to_string_lossy().into());
        }

        return Some(DetectedTool {
            name: config.name.into(),
            version,
            executable: Some(exe_path),
            install_location: Some(base_path),
            install_method: method,
            cli_available: cli_path.is_some(),
            metadata,
        });
    }

    None
}

// ─── macOS Editor Detection ────────────────────────────────────────────────────

/// Parse version from macOS Info.plist using simple text matching.
#[cfg(target_os = "macos")]
fn read_macos_version_from_plist(app_path: &Path) -> Option<String> {
    let plist_path = app_path.join("Contents").join("Info.plist");
    let content = std::fs::read_to_string(plist_path).ok()?;

    let key = "CFBundleShortVersionString";
    let key_pos = content.find(key)?;
    let after_key = &content[key_pos + key.len()..];

    let string_start = after_key.find("<string>")? + 8;
    let rest = &after_key[string_start..];
    let string_end = rest.find("</string>")?;

    Some(rest[..string_end].trim().to_string())
}

/// Read version from a macOS .app bundle (package.json first, then Info.plist).
#[cfg(target_os = "macos")]
fn read_version_from_macos_app(app_path: &Path) -> Option<String> {
    // Try package.json first (more precise for Electron apps)
    let pkg = app_path
        .join("Contents")
        .join("Resources")
        .join("app")
        .join("package.json");
    if let Ok(content) = std::fs::read_to_string(&pkg) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(v) = json.get("version").and_then(|v| v.as_str()) {
                return Some(v.to_string());
            }
        }
    }

    // Fall back to Info.plist
    read_macos_version_from_plist(app_path)
}

/// Detect an editor on macOS by checking /Applications and ~/Applications.
#[cfg(target_os = "macos")]
fn detect_editor_macos(config: &EditorConfig) -> Option<DetectedTool> {
    let home = std::env::var("HOME").unwrap_or_default();

    let candidates = vec![
        (
            PathBuf::from("/Applications").join(config.macos_app),
            InstallMethod::SystemInstall,
        ),
        (
            PathBuf::from(&home)
                .join("Applications")
                .join(config.macos_app),
            InstallMethod::UserInstall,
        ),
    ];

    for (app_path, method) in candidates {
        if !app_path.exists() {
            continue;
        }

        let cli_path = app_path
            .join("Contents")
            .join("Resources")
            .join("app")
            .join("bin")
            .join(config.cli_name);

        let version = read_version_from_macos_app(&app_path);

        let mut metadata = HashMap::new();
        metadata.insert("id".into(), config.id.into());
        metadata.insert("detection_method".into(), "macos_app_bundle".into());
        if cli_path.exists() {
            metadata.insert("cli_path".into(), cli_path.to_string_lossy().into());
        }

        return Some(DetectedTool {
            name: config.name.into(),
            version,
            executable: if cli_path.exists() {
                Some(cli_path)
            } else {
                None
            },
            install_location: Some(app_path),
            install_method: method,
            cli_available: cli_path.exists(),
            metadata,
        });
    }

    None
}

// ─── Generic Editor Detection ──────────────────────────────────────────────────

/// Tier 3 (all platforms): Find editor via PATH lookup, walk up to install root.
fn detect_editor_from_path(config: &EditorConfig) -> Option<DetectedTool> {
    let cmd_path = which_command(config.cli_name)?;
    let cmd_path_str = cmd_path.to_string_lossy().to_string();

    // CLI shim is typically at .../bin/<name> or .../resources/app/bin/<name>
    // Walk up to find the install root.
    let install_root = cmd_path
        .parent()? // bin/
        .parent() // app/ or install_root/
        .and_then(|p| {
            // If parent is "app", keep going up (resources/app/bin pattern)
            if p.file_name().map(|n| n == "app").unwrap_or(false) {
                p.parent()?.parent() // resources/ → install_root/
            } else {
                Some(p) // Already at install root (bin/ pattern)
            }
        })?
        .to_path_buf();

    let version = read_version_from_package_json(&install_root);

    let mut metadata = HashMap::new();
    metadata.insert("id".into(), config.id.into());
    metadata.insert("cli_path".into(), cmd_path_str);
    metadata.insert("detection_method".into(), "path".into());

    let exe = install_root.join(config.exe_name);

    Some(DetectedTool {
        name: config.name.into(),
        version,
        executable: if exe.exists() {
            Some(exe)
        } else {
            Some(cmd_path)
        },
        install_location: Some(install_root),
        install_method: InstallMethod::Unknown,
        cli_available: true,
        metadata,
    })
}

/// Detect a single editor using tiered strategy.
fn detect_editor(config: &EditorConfig) -> Option<DetectedTool> {
    #[cfg(target_os = "windows")]
    {
        // Tier 1: Registry (most reliable — version + path in one shot)
        if let Some(tool) = detect_editor_from_registry(config) {
            return Some(tool);
        }

        // Tier 2: Known filesystem locations
        if let Some(tool) = detect_editor_from_filesystem(config) {
            return Some(tool);
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: Check /Applications and ~/Applications bundles
        if let Some(tool) = detect_editor_macos(config) {
            return Some(tool);
        }
    }

    // Tier 3: PATH fallback (all platforms)
    detect_editor_from_path(config)
}

// ─── Tauri: Editor Detection ───────────────────────────────────────────────────

/// Detect all supported editors using multi-strategy detection.
#[tauri::command]
pub fn detect_editors() -> Vec<DetectedTool> {
    get_editor_configs()
        .iter()
        .filter_map(detect_editor)
        .collect()
}

// ─── Claude Code Detection ─────────────────────────────────────────────────────

/// Detect Claude Code via npm global install.
fn detect_claude_code_npm() -> Option<DetectedTool> {
    let npm_prefix = get_npm_prefix().or_else(|| {
        // Fallback: standard npm global location
        #[cfg(target_os = "windows")]
        {
            std::env::var("APPDATA")
                .ok()
                .map(|appdata| PathBuf::from(appdata).join("npm"))
        }
        #[cfg(not(target_os = "windows"))]
        {
            Some(PathBuf::from("/usr/local"))
        }
    })?;

    let package_json_path = npm_prefix
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code")
        .join("package.json");

    if !package_json_path.exists() {
        return None;
    }

    // Parse version from package.json
    let version = std::fs::read_to_string(&package_json_path)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .and_then(|json| json.get("version").and_then(|v| v.as_str()).map(String::from));

    // Check which shims exist
    #[cfg(target_os = "windows")]
    let cmd_shim = npm_prefix.join("claude.cmd");
    #[cfg(not(target_os = "windows"))]
    let cmd_shim = npm_prefix.join("bin").join("claude");

    #[cfg(target_os = "windows")]
    let ps1_shim = Some(npm_prefix.join("claude.ps1"));
    #[cfg(not(target_os = "windows"))]
    let ps1_shim: Option<PathBuf> = None;

    let cli_available =
        cmd_shim.exists() || ps1_shim.as_ref().map(|p| p.exists()).unwrap_or(false);

    let mut metadata = HashMap::new();
    metadata.insert("npm_prefix".into(), npm_prefix.to_string_lossy().into());
    metadata.insert("detection_method".into(), "npm_global".into());

    if cmd_shim.exists() {
        metadata.insert("cmd_shim".into(), cmd_shim.to_string_lossy().into());
    }
    if let Some(ref ps1) = ps1_shim {
        if ps1.exists() {
            metadata.insert("ps1_shim".into(), ps1.to_string_lossy().into());
        }
    }

    let cli_js = npm_prefix
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code")
        .join("cli.js");
    if cli_js.exists() {
        metadata.insert("entry_point".into(), cli_js.to_string_lossy().into());
    }

    // Check node availability
    let node_version = get_command_output("node", &["--version"]);
    if let Some(ref nv) = node_version {
        metadata.insert("node_version".into(), nv.clone());
    }
    metadata.insert(
        "node_available".into(),
        node_version.is_some().to_string(),
    );

    Some(DetectedTool {
        name: "Claude Code".into(),
        version,
        executable: if cmd_shim.exists() {
            Some(cmd_shim)
        } else {
            ps1_shim.filter(|p| p.exists())
        },
        install_location: Some(
            npm_prefix
                .join("node_modules")
                .join("@anthropic-ai")
                .join("claude-code"),
        ),
        install_method: InstallMethod::NpmGlobal,
        cli_available,
        metadata,
    })
}

/// Fallback: detect Claude Code from config directory presence (Windows).
#[cfg(target_os = "windows")]
fn detect_claude_code_from_config() -> Option<DetectedTool> {
    let appdata = std::env::var("APPDATA").ok()?;
    let config_dir = PathBuf::from(&appdata).join("Claude").join("claude-code");

    if !config_dir.exists() {
        return None;
    }

    // Try to find version hint from subdirectory names
    let version = std::fs::read_dir(&config_dir)
        .ok()?
        .filter_map(Result::ok)
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.chars().next()?.is_ascii_digit() {
                Some(name)
            } else {
                None
            }
        })
        .max(); // Lexicographic max works for semver with single-digit major

    let mut metadata = HashMap::new();
    metadata.insert("config_dir".into(), config_dir.to_string_lossy().into());
    metadata.insert("detection_method".into(), "config_dir_only".into());
    metadata.insert(
        "warning".into(),
        "Package not found via npm — may be uninstalled or installed via non-standard method"
            .into(),
    );

    Some(DetectedTool {
        name: "Claude Code".into(),
        version,
        executable: None,
        install_location: None,
        install_method: InstallMethod::Unknown,
        cli_available: false,
        metadata,
    })
}

/// Internal: Run full Claude Code detection.
fn detect_claude_code_inner() -> Option<DetectedTool> {
    // 1. npm global install (most common, works on both platforms)
    if let Some(tool) = detect_claude_code_npm() {
        return Some(tool);
    }

    // 2. PATH lookup (finds /usr/local/bin/claude, brew installs, etc.)
    if let Some(cmd_path) = which_command("claude") {
        let node_version = get_command_output("node", &["--version"]);
        let mut metadata = HashMap::new();
        metadata.insert("detection_method".into(), "path".into());
        metadata.insert("cli_path".into(), cmd_path.to_string_lossy().into());
        if let Some(ref nv) = node_version {
            metadata.insert("node_version".into(), nv.clone());
        }
        metadata.insert(
            "node_available".into(),
            node_version.is_some().to_string(),
        );

        return Some(DetectedTool {
            name: "Claude Code".into(),
            version: None,
            executable: Some(cmd_path),
            install_location: None,
            install_method: InstallMethod::Unknown,
            cli_available: true,
            metadata,
        });
    }

    // 3. Platform-specific fallback
    #[cfg(target_os = "windows")]
    {
        if let Some(tool) = detect_claude_code_from_config() {
            return Some(tool);
        }
    }

    None
}

/// Tauri command: Detect Claude Code with full multi-strategy detection.
#[tauri::command]
pub fn detect_claude_code() -> Option<DetectedTool> {
    detect_claude_code_inner()
}

/// Legacy Tauri command: Returns Option<String> (CLI path) for backward compat.
#[tauri::command]
pub fn detect_claude_cli() -> Option<String> {
    detect_claude_code_inner().and_then(|tool| {
        tool.executable
            .map(|p| p.to_string_lossy().to_string())
            .or_else(|| tool.metadata.get("cli_path").cloned())
    })
}

// ─── Combined Detection ────────────────────────────────────────────────────────

/// Detect all dev tools in one call.
#[tauri::command]
pub fn detect_all_tools() -> DetectionReport {
    DetectionReport {
        editors: detect_editors(),
        claude_code: detect_claude_code_inner(),
        node_available: which_command("node").is_some(),
        npm_prefix: get_npm_prefix(),
    }
}

// ─── Existing Prism Detection ──────────────────────────────────────────────────

#[tauri::command]
pub fn detect_existing_prism() -> Option<PrismInstallInfo> {
    #[cfg(target_os = "windows")]
    {
        detect_existing_prism_windows()
    }
    #[cfg(target_os = "macos")]
    {
        detect_existing_prism_macos()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        None
    }
}

#[cfg(target_os = "windows")]
fn detect_existing_prism_windows() -> Option<PrismInstallInfo> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu.open_subkey("Software\\Prism").ok()?;
    let install_dir: String = key.get_value("InstallDir").ok()?;
    let version: Option<String> = key.get_value("Version").ok();

    Some(PrismInstallInfo {
        install_dir,
        version,
    })
}

#[cfg(target_os = "macos")]
fn detect_existing_prism_macos() -> Option<PrismInstallInfo> {
    let home = std::env::var("HOME").unwrap_or_default();
    let cli_path = format!("{}/.prism/bin/prism-cli", home);
    if Path::new(&cli_path).exists() {
        Some(PrismInstallInfo {
            install_dir: format!("{}/.prism", home),
            version: None,
        })
    } else {
        None
    }
}

// ─── OS Info ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn detect_os_info() -> OsInfo {
    OsInfo {
        name: std::env::consts::OS.to_string(),
        version: os_version(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

fn os_version() -> String {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion") {
            let display: String = key
                .get_value("DisplayVersion")
                .unwrap_or_else(|_| "Unknown".to_string());
            let build: String = key
                .get_value("CurrentBuildNumber")
                .unwrap_or_else(|_| "0".to_string());
            let product: String = key
                .get_value("ProductName")
                .unwrap_or_else(|_| "Windows".to_string());
            return format!("{} {} (Build {})", product, display, build);
        }
        "Windows (unknown version)".to_string()
    }
    #[cfg(not(target_os = "windows"))]
    {
        "macOS".to_string()
    }
}

// ─── Disk Space ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn detect_disk_space(path: String) -> DiskInfo {
    let available = get_available_disk_space(&path);
    DiskInfo {
        available_bytes: available,
        available_mb: available / (1024 * 1024),
    }
}

#[cfg(target_os = "windows")]
fn get_available_disk_space(path: &str) -> u64 {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let wide_path: Vec<u16> = OsStr::new(path).encode_wide().chain(Some(0)).collect();
    let mut free_bytes: u64 = 0;
    unsafe {
        winapi::um::fileapi::GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut free_bytes as *mut u64 as *mut _,
        );
    }
    free_bytes
}

#[cfg(target_os = "macos")]
fn get_available_disk_space(path: &str) -> u64 {
    // Use `df -k` to get available space in KB, convert to bytes
    let output = Command::new("df")
        .args(["-k", path])
        .output()
        .ok()
        .filter(|o| o.status.success());

    if let Some(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // df -k format: Filesystem 1024-blocks Used Available ...
        if let Some(line) = stdout.lines().nth(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() >= 4 {
                if let Ok(kb) = fields[3].parse::<u64>() {
                    return kb * 1024;
                }
            }
        }
    }
    0
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_available_disk_space(_path: &str) -> u64 {
    0
}

// ─── Combined Preflight ────────────────────────────────────────────────────────

#[tauri::command]
pub fn run_preflight(install_dir: String) -> PreflightResult {
    PreflightResult {
        editors: detect_editors(),
        claude_code: detect_claude_code_inner(),
        existing_prism: detect_existing_prism(),
        os_info: detect_os_info(),
        disk_info: detect_disk_space(install_dir),
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_editor_configs_complete() {
        let configs = get_editor_configs();
        assert_eq!(configs.len(), 3);
        let ids: Vec<&str> = configs.iter().map(|c| c.id).collect();
        assert!(ids.contains(&"vscode"));
        assert!(ids.contains(&"cursor"));
        assert!(ids.contains(&"windsurf"));
    }

    #[test]
    fn test_detect_editors_returns_detected_tools() {
        // Type check: detect_editors returns Vec<DetectedTool>
        let editors: Vec<DetectedTool> = detect_editors();
        // May or may not find editors depending on the machine
        for editor in &editors {
            assert!(!editor.name.is_empty());
            assert!(editor.metadata.contains_key("id"));
        }
    }

    #[test]
    fn test_detect_claude_code_returns_option() {
        // Type check: detect_claude_code returns Option<DetectedTool>
        let _result: Option<DetectedTool> = detect_claude_code();
    }

    #[test]
    fn test_detect_claude_cli_compat() {
        // Legacy wrapper should return Option<String>
        let _result: Option<String> = detect_claude_cli();
    }

    #[test]
    fn test_detect_all_tools_report() {
        let report = detect_all_tools();
        // Should always produce a valid report
        assert!(report.editors.len() <= 3);
        // node_available and npm_prefix are informational
    }

    #[test]
    fn test_which_command_finds_known_binary() {
        // cmd.exe (Windows) or sh (macOS) should always be on PATH
        #[cfg(target_os = "windows")]
        {
            let result = which_command("cmd.exe");
            assert!(result.is_some(), "cmd.exe should be on PATH");
        }
        #[cfg(target_os = "macos")]
        {
            let result = which_command("sh");
            assert!(result.is_some(), "sh should be on PATH");
        }
    }

    #[test]
    fn test_which_command_nonexistent() {
        let result = which_command("nonexistent_binary_xyz_12345");
        assert!(result.is_none());
    }

    #[test]
    fn test_get_command_output_works() {
        #[cfg(target_os = "windows")]
        {
            let output = get_command_output("cmd.exe", &["/c", "echo hello"]);
            assert!(output.is_some());
            assert!(output.unwrap().contains("hello"));
        }
        #[cfg(target_os = "macos")]
        {
            let output = get_command_output("echo", &["hello"]);
            assert!(output.is_some());
            assert!(output.unwrap().contains("hello"));
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_editor_candidate_paths_windows() {
        let configs = get_editor_configs();
        for config in &configs {
            let paths = get_editor_candidate_paths(config);
            assert!(!paths.is_empty(), "Should have candidate paths for {}", config.name);
            // System path (Program Files) should always be present
            assert!(
                paths.iter().any(|(p, _)| p.to_string_lossy().contains("Program Files")),
                "Should have Program Files path for {}",
                config.name
            );
        }
    }

    #[test]
    fn test_detect_os_info_returns_valid() {
        let info = detect_os_info();
        assert!(!info.name.is_empty());
        assert!(!info.arch.is_empty());
    }

    #[test]
    fn test_disk_space_returns_something() {
        #[cfg(target_os = "windows")]
        {
            let info = detect_disk_space("C:\\".to_string());
            assert!(info.available_bytes > 0, "Disk space should be > 0");
        }
    }

    #[test]
    fn test_install_method_serializes() {
        let json = serde_json::to_string(&InstallMethod::NpmGlobal).unwrap();
        assert!(json.contains("NpmGlobal"));

        let json = serde_json::to_string(&InstallMethod::SystemInstall).unwrap();
        assert!(json.contains("SystemInstall"));
    }

    #[test]
    fn test_detected_tool_from_editor_info() {
        let info = EditorInfo {
            id: "cursor".to_string(),
            name: "Cursor".to_string(),
            path: "C:\\Program Files\\cursor".to_string(),
            cmd_path: "C:\\Program Files\\cursor\\resources\\app\\bin\\cursor.cmd".to_string(),
        };
        let tool = DetectedTool::from(&info);
        assert_eq!(tool.name, "Cursor");
        assert!(tool.cli_available);
        assert!(tool.metadata.contains_key("cli_path"));
    }

    #[test]
    fn test_preflight_result_complete() {
        let result = run_preflight("C:\\".to_string());
        // Should always return a valid preflight result
        assert!(!result.os_info.name.is_empty());
    }

    #[test]
    fn test_detection_report_serializes() {
        let report = DetectionReport {
            editors: vec![],
            claude_code: None,
            node_available: false,
            npm_prefix: None,
        };
        let json = serde_json::to_string(&report).unwrap();
        assert!(json.contains("editors"));
        assert!(json.contains("node_available"));
    }
}
