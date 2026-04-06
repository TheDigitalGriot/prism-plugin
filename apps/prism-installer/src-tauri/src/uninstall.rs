use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct UninstallResult {
    pub success: bool,
    pub message: String,
}

/// Register the uninstaller in Windows Add/Remove Programs.
/// Only compiled on Windows.
#[cfg(target_os = "windows")]
pub fn register_uninstaller(install_dir: &str, version: &str, exe_path: &str) {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let uninstall_path =
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Prism";

    if let Ok((key, _)) = hkcu.create_subkey(uninstall_path) {
        let quiet_uninstall = format!("\"{}\" --uninstall", exe_path);
        let _ = key.set_value("DisplayName", &"Prism");
        let _ = key.set_value("DisplayVersion", &version);
        let _ = key.set_value("Publisher", &"TheDigitalGriot");
        let _ = key.set_value("InstallLocation", &install_dir);
        let _ = key.set_value("UninstallString", &quiet_uninstall.as_str());
        let _ = key.set_value("QuietUninstallString", &quiet_uninstall.as_str());
        let _ = key.set_value("URLInfoAbout", &"https://github.com/TheDigitalGriot/prism-plugin");
        let _ = key.set_value("NoModify", &1u32);
        let _ = key.set_value("NoRepair", &1u32);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn register_uninstaller(_install_dir: &str, _version: &str, _exe_path: &str) {
    // No-op on macOS
}

/// Remove the Prism PATH entry from HKCU\Environment on Windows.
#[cfg(target_os = "windows")]
fn remove_from_path_windows(bin_dir: &str) {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(env_key) = hkcu.open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE) {
        if let Ok(current_path) = env_key.get_value::<String, _>("Path") {
            let new_path: Vec<&str> = current_path
                .split(';')
                .filter(|e| {
                    !e.trim().eq_ignore_ascii_case(bin_dir)
                        && !e.trim().eq_ignore_ascii_case(&bin_dir.replace('/', "\\"))
                })
                .collect();
            let joined = new_path.join(";");
            let _ = env_key.set_value("Path", &joined);

            // Broadcast WM_SETTINGCHANGE
            unsafe {
                use winapi::um::winuser::{
                    SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG,
                    WM_SETTINGCHANGE,
                };
                let env: Vec<u16> = "Environment\0".encode_utf16().collect();
                SendMessageTimeoutW(
                    HWND_BROADCAST,
                    WM_SETTINGCHANGE,
                    0,
                    env.as_ptr() as isize,
                    SMTO_ABORTIFHUNG,
                    2000,
                    std::ptr::null_mut(),
                );
            }
        }
    }
}

/// Remove uninstall registry entries on Windows.
#[cfg(target_os = "windows")]
fn remove_registry_keys() {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let _ = hkcu.delete_subkey_all(
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Prism",
    );
    let _ = hkcu.delete_subkey_all("Software\\Prism");
}

/// Full uninstall — removes CLI binary, PATH entry, registry keys.
#[tauri::command]
pub fn uninstall(install_dir: String) -> UninstallResult {
    let install_path = PathBuf::from(&install_dir);
    let bin_dir = install_path.join("bin");
    let mut messages: Vec<String> = Vec::new();

    // Remove CLI binary
    let cli_name = if cfg!(target_os = "windows") {
        "prism-cli.exe"
    } else {
        "prism-cli"
    };
    let cli_path = bin_dir.join(cli_name);
    if cli_path.exists() {
        match fs::remove_file(&cli_path) {
            Ok(_) => messages.push("Removed CLI binary".into()),
            Err(e) => messages.push(format!("Failed to remove CLI binary: {}", e)),
        }
    }

    // Remove install directory if empty
    let _ = fs::remove_dir(&install_path);

    // Platform-specific cleanup
    #[cfg(target_os = "windows")]
    {
        let bin_str = bin_dir.to_string_lossy().to_string();
        remove_from_path_windows(&bin_str);
        remove_registry_keys();
        messages.push("Removed PATH entry and registry keys".into());
    }

    UninstallResult {
        success: true,
        message: messages.join("; "),
    }
}
