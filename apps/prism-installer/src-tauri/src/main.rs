#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--uninstall".to_string()) {
        // Headless uninstall: remove from default install dir
        #[cfg(target_os = "windows")]
        {
            let install_dir = std::env::var("LOCALAPPDATA")
                .map(|d| format!("{}\\Prism", d))
                .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local\\Prism".into());
            prism_installer_lib::headless_uninstall(&install_dir);
        }
        return;
    }
    prism_installer_lib::run()
}
