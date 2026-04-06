use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
}

// ─── CLI Binary Install ────────────────────────────────────────────────────────

#[tauri::command]
pub fn install_cli(source_path: String, install_dir: String) -> InstallResult {
    let bin_dir = PathBuf::from(&install_dir).join("bin");

    // Create bin directory
    if let Err(e) = fs::create_dir_all(&bin_dir) {
        return InstallResult {
            success: false,
            message: format!("Failed to create bin directory: {}", e),
        };
    }

    // Determine target filename
    let target_name = if cfg!(target_os = "windows") {
        "prism-cli.exe"
    } else {
        "prism-cli"
    };
    let target_path = bin_dir.join(target_name);

    // Copy binary
    if let Err(e) = fs::copy(&source_path, &target_path) {
        return InstallResult {
            success: false,
            message: format!("Failed to copy CLI binary: {}", e),
        };
    }

    // Set executable permission on macOS
    #[cfg(target_os = "macos")]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&target_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&target_path, perms);
        }
    }

    // Initialize ~/.prism/ directory
    if let Err(e) = init_prism_dir() {
        return InstallResult {
            success: false,
            message: format!("CLI copied but failed to init .prism dir: {}", e),
        };
    }

    // Configure PATH
    let bin_path = bin_dir.to_string_lossy().to_string();
    if let Err(e) = configure_path(&bin_path) {
        return InstallResult {
            success: false,
            message: format!("CLI installed but PATH configuration failed: {}", e),
        };
    }

    // Register install in registry (Windows) or record version (macOS)
    #[cfg(target_os = "windows")]
    {
        let version =
            std::env::var("PRISM_VERSION").unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
        if let Err(e) = register_install_windows(&install_dir, &version) {
            return InstallResult {
                success: false,
                message: format!("CLI installed but registry write failed: {}", e),
            };
        }
        // Register in Add/Remove Programs
        let exe_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .unwrap_or_default();
        crate::uninstall::register_uninstaller(&install_dir, &version, &exe_path);
    }

    InstallResult {
        success: true,
        message: format!("Prism CLI installed to {}", target_path.display()),
    }
}

// ─── .prism/ Directory Initialization ──────────────────────────────────────────

fn init_prism_dir() -> Result<(), String> {
    let home = home_dir().ok_or("Could not determine home directory")?;
    let prism_dir = home.join(".prism");

    fs::create_dir_all(&prism_dir).map_err(|e| format!("mkdir .prism: {}", e))?;

    let workspaces = prism_dir.join("workspaces.json");
    if !workspaces.exists() {
        fs::write(&workspaces, r#"{"projects":[]}"#)
            .map_err(|e| format!("write workspaces.json: {}", e))?;
    }

    Ok(())
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

// ─── PATH Configuration ───────────────────────────────────────────────────────

fn configure_path(bin_dir: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        configure_path_windows(bin_dir)
    }
    #[cfg(target_os = "macos")]
    {
        configure_path_macos(bin_dir)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = bin_dir;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn configure_path_windows(bin_dir: &str) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let env_key = hkcu
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
        .map_err(|e| format!("Open Environment key: {}", e))?;

    // Read current PATH
    let current_path: String = env_key.get_value("Path").unwrap_or_default();

    // Check if already present (case-insensitive on Windows)
    let bin_dir_lower = bin_dir.to_lowercase();
    let already_present = current_path
        .split(';')
        .any(|entry| entry.trim().to_lowercase() == bin_dir_lower);

    if already_present {
        return Ok(());
    }

    // Append to PATH
    let new_path = if current_path.is_empty() {
        bin_dir.to_string()
    } else {
        format!("{};{}", current_path.trim_end_matches(';'), bin_dir)
    };

    env_key
        .set_value("Path", &new_path)
        .map_err(|e| format!("Write PATH: {}", e))?;

    // Broadcast WM_SETTINGCHANGE so open shells pick up the new PATH
    broadcast_settings_change();

    Ok(())
}

#[cfg(target_os = "windows")]
fn broadcast_settings_change() {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::winuser::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};

    let env_wide: Vec<u16> = OsStr::new("Environment")
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            env_wide.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            std::ptr::null_mut(),
        );
    }
}

#[cfg(target_os = "macos")]
fn configure_path_macos(bin_dir: &str) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let export_line = format!("export PATH=\"$PATH:{}\"", bin_dir);

    for rc_file in &[".zshrc", ".bash_profile"] {
        let path = PathBuf::from(&home).join(rc_file);
        append_if_absent(&path, &export_line)?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn append_if_absent(path: &std::path::Path, line: &str) -> Result<(), String> {
    // Read existing content (file may not exist)
    let content = fs::read_to_string(path).unwrap_or_default();

    // Check if line already present
    if content.lines().any(|l| l.trim() == line.trim()) {
        return Ok(());
    }

    // Append with a preceding newline
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("Open {}: {}", path.display(), e))?;

    writeln!(file, "\n# Added by Prism installer")
        .map_err(|e| format!("Write {}: {}", path.display(), e))?;
    writeln!(file, "{}", line).map_err(|e| format!("Write {}: {}", path.display(), e))?;

    Ok(())
}

// ─── Windows Registry Install Registration ─────────────────────────────────────

#[cfg(target_os = "windows")]
fn register_install_windows(install_dir: &str, version: &str) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_WRITE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Write to Software\Prism
    let (key, _) = hkcu
        .create_subkey_with_flags("Software\\Prism", KEY_WRITE)
        .map_err(|e| format!("Create Prism key: {}", e))?;

    key.set_value("InstallDir", &install_dir)
        .map_err(|e| format!("Write InstallDir: {}", e))?;
    key.set_value("Version", &version)
        .map_err(|e| format!("Write Version: {}", e))?;

    Ok(())
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_home_dir_returns_some() {
        assert!(home_dir().is_some(), "Should resolve home directory");
    }

    #[test]
    fn test_init_prism_dir_idempotent() {
        // This test is safe to run — it only creates if missing
        let result = init_prism_dir();
        assert!(result.is_ok(), "init_prism_dir should succeed: {:?}", result);

        // Run again — should succeed (idempotent)
        let result2 = init_prism_dir();
        assert!(result2.is_ok(), "Second call should also succeed");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_path_parsing() {
        let sample_path = r"C:\Users\test\bin;C:\Windows\system32;C:\some\path";
        let target = r"C:\Users\test\bin";
        let found = sample_path
            .split(';')
            .any(|e| e.trim().to_lowercase() == target.to_lowercase());
        assert!(found, "Should find existing path entry");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_path_not_found() {
        let sample_path = r"C:\Windows\system32;C:\some\path";
        let target = r"C:\Users\test\bin";
        let found = sample_path
            .split(';')
            .any(|e| e.trim().to_lowercase() == target.to_lowercase());
        assert!(!found, "Should NOT find missing path entry");
    }
}
