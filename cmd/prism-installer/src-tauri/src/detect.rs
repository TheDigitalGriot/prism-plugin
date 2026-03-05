use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct EditorInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub cmd_path: String,
}

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
    pub editors: Vec<EditorInfo>,
    pub claude_cli: Option<String>,
    pub existing_prism: Option<PrismInstallInfo>,
    pub os_info: OsInfo,
    pub disk_info: DiskInfo,
}

// ─── Editor Detection ──────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_editor_candidates() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        (
            "vscode",
            "VS Code",
            "Programs\\Microsoft VS Code\\bin\\code.cmd",
        ),
        (
            "cursor",
            "Cursor",
            "Programs\\cursor\\resources\\app\\bin\\cursor.cmd",
        ),
        (
            "windsurf",
            "Windsurf",
            "Programs\\windsurf\\resources\\app\\bin\\windsurf.cmd",
        ),
    ]
}

#[cfg(target_os = "macos")]
fn get_editor_candidates() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        (
            "vscode",
            "VS Code",
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        ),
        (
            "cursor",
            "Cursor",
            "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
        ),
        (
            "windsurf",
            "Windsurf",
            "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
        ),
    ]
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_editor_candidates() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![]
}

#[tauri::command]
pub fn detect_editors() -> Vec<EditorInfo> {
    let mut editors = Vec::new();

    for (id, name, relative_path) in get_editor_candidates() {
        let full_path = resolve_editor_path(relative_path);
        if Path::new(&full_path).exists() {
            let install_dir = Path::new(&full_path)
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            editors.push(EditorInfo {
                id: id.to_string(),
                name: name.to_string(),
                path: install_dir,
                cmd_path: full_path,
            });
        }
    }

    editors
}

#[cfg(target_os = "windows")]
fn resolve_editor_path(relative: &str) -> String {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    PathBuf::from(&local_app_data)
        .join(relative)
        .to_string_lossy()
        .to_string()
}

#[cfg(target_os = "macos")]
fn resolve_editor_path(absolute: &str) -> String {
    absolute.to_string()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn resolve_editor_path(_path: &str) -> String {
    String::new()
}

// ─── Claude CLI Detection ──────────────────────────────────────────────────────

#[tauri::command]
pub fn detect_claude_cli() -> Option<String> {
    get_claude_candidates()
        .into_iter()
        .find(|path| Path::new(path).exists())
}

#[cfg(target_os = "windows")]
fn get_claude_candidates() -> Vec<String> {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    vec![PathBuf::from(&local_app_data)
        .join("Programs\\claude\\resources\\app\\bin\\claude.cmd")
        .to_string_lossy()
        .to_string()]
}

#[cfg(target_os = "macos")]
fn get_claude_candidates() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    vec![
        "/usr/local/bin/claude".to_string(),
        format!("{}/.claude/bin/claude", home),
    ]
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_claude_candidates() -> Vec<String> {
    vec![]
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
        // Read from registry for accurate version info
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

#[cfg(not(target_os = "windows"))]
fn get_available_disk_space(_path: &str) -> u64 {
    // On macOS, use statvfs
    0 // Placeholder — will be implemented with libc::statvfs in macOS build
}

// ─── Combined Preflight ────────────────────────────────────────────────────────

#[tauri::command]
pub fn run_preflight(install_dir: String) -> PreflightResult {
    PreflightResult {
        editors: detect_editors(),
        claude_cli: detect_claude_cli(),
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
    fn test_editor_candidates_not_empty() {
        let candidates = get_editor_candidates();
        assert!(!candidates.is_empty(), "Should have editor candidates for this OS");
    }

    #[test]
    fn test_detect_os_info_returns_valid() {
        let info = detect_os_info();
        assert!(!info.name.is_empty());
        assert!(!info.arch.is_empty());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_resolve_editor_path_windows() {
        let path = resolve_editor_path("Programs\\Test\\test.cmd");
        assert!(path.contains("Programs"));
        assert!(path.contains("test.cmd"));
    }

    #[test]
    fn test_disk_space_returns_something() {
        #[cfg(target_os = "windows")]
        {
            let info = detect_disk_space("C:\\".to_string());
            assert!(info.available_bytes > 0, "Disk space should be > 0");
        }
    }
}
