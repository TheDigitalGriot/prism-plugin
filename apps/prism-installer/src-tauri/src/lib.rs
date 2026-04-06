mod detect;
mod download;
mod install_cli;
mod install_extension;
mod install_plugin;
mod uninstall;

/// Opens a new terminal window (best-effort, platform-specific).
#[tauri::command]
fn open_terminal() {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd.exe")
            .args(["/c", "start", "cmd.exe"])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .args(["-a", "Terminal"])
            .spawn();
    }
}

/// Headless uninstall invoked via `--uninstall` CLI flag (no UI).
pub fn headless_uninstall(install_dir: &str) {
    let result = uninstall::uninstall(install_dir.to_string());
    eprintln!(
        "Uninstall: {} — {}",
        if result.success { "OK" } else { "FAILED" },
        result.message
    );
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect::detect_editors,
            detect::detect_claude_cli,
            detect::detect_claude_code,
            detect::detect_all_tools,
            detect::detect_existing_prism,
            detect::detect_os_info,
            detect::detect_disk_space,
            detect::run_preflight,
            install_cli::install_cli,
            install_extension::install_all_extensions,
            install_plugin::install_plugin,
            download::download_desktop_app,
            download::run_downloaded_installer,
            uninstall::uninstall,
            open_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
