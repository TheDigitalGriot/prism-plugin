mod detect;
mod install_cli;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            detect::detect_editors,
            detect::detect_claude_cli,
            detect::detect_existing_prism,
            detect::detect_os_info,
            detect::detect_disk_space,
            detect::run_preflight,
            install_cli::install_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
