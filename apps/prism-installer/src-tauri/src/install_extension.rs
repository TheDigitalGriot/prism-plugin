use crate::detect::DetectedTool;
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct ExtensionInstallResult {
    pub editor: String,
    pub success: bool,
    pub exit_code: i32,
    pub output: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AllExtensionsResult {
    pub results: Vec<ExtensionInstallResult>,
    pub total_success: usize,
    pub total_attempted: usize,
}

/// Get the CLI command path from a DetectedTool.
/// Prefers metadata["cli_path"], falls back to executable path.
fn get_cli_path(editor: &DetectedTool) -> Option<String> {
    editor
        .metadata
        .get("cli_path")
        .cloned()
        .or_else(|| {
            editor
                .executable
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
        })
}

/// Install a VSIX extension into a single editor.
fn install_vsix_single(editor: &DetectedTool, vsix_path: &str) -> ExtensionInstallResult {
    let cli_path = match get_cli_path(editor) {
        Some(path) => path,
        None => {
            return ExtensionInstallResult {
                editor: editor.name.clone(),
                success: false,
                exit_code: -1,
                output: "No CLI path available for this editor".to_string(),
            }
        }
    };

    let result = run_editor_command(&cli_path, vsix_path);

    let version_str = editor
        .version
        .as_deref()
        .map(|v| format!(" v{}", v))
        .unwrap_or_default();

    match result {
        Ok((code, output)) => ExtensionInstallResult {
            editor: format!("{}{}", editor.name, version_str),
            success: code == 0,
            exit_code: code,
            output,
        },
        Err(e) => ExtensionInstallResult {
            editor: format!("{}{}", editor.name, version_str),
            success: false,
            exit_code: -1,
            output: e,
        },
    }
}

#[cfg(target_os = "windows")]
fn run_editor_command(cmd_path: &str, vsix_path: &str) -> Result<(i32, String), String> {
    let output = Command::new("cmd.exe")
        .args([
            "/c",
            &format!(
                "\"{}\" --install-extension \"{}\" --force",
                cmd_path, vsix_path
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to run cmd.exe: {}", e))?;

    let code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stderr.is_empty() {
        stdout
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok((code, combined))
}

#[cfg(target_os = "macos")]
fn run_editor_command(cmd_path: &str, vsix_path: &str) -> Result<(i32, String), String> {
    let output = Command::new(cmd_path)
        .args(["--install-extension", vsix_path, "--force"])
        .output()
        .map_err(|e| format!("Failed to run {}: {}", cmd_path, e))?;

    let code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stderr.is_empty() {
        stdout
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok((code, combined))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn run_editor_command(_cmd_path: &str, _vsix_path: &str) -> Result<(i32, String), String> {
    Err("Unsupported platform".to_string())
}

/// Install VSIX extension into all detected editors.
#[tauri::command]
pub fn install_all_extensions(
    editors: Vec<DetectedTool>,
    vsix_path: String,
) -> AllExtensionsResult {
    let mut results = Vec::new();
    let total_attempted = editors.len();

    for editor in &editors {
        let result = install_vsix_single(editor, &vsix_path);
        results.push(result);
    }

    let total_success = results.iter().filter(|r| r.success).count();

    AllExtensionsResult {
        results,
        total_success,
        total_attempted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_extensions_empty_editors() {
        let result = install_all_extensions(vec![], "test.vsix".to_string());
        assert_eq!(result.total_attempted, 0);
        assert_eq!(result.total_success, 0);
        assert!(result.results.is_empty());
    }
}
