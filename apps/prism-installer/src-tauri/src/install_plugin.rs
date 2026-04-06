use crate::detect::DetectedTool;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct PluginInstallResult {
    pub success: bool,
    pub method: String, // "cli" or "file_copy"
    pub message: String,
}

/// Install Claude plugin via CLI marketplace command.
fn install_plugin_via_cli(claude_path: &str) -> Result<String, String> {
    let output = run_claude_install(claude_path)?;
    let code = output.0;
    if code == 0 {
        Ok(format!("Plugin installed via Claude CLI (exit {})", code))
    } else {
        Err(format!(
            "Claude CLI install returned exit code {}: {}",
            code, output.1
        ))
    }
}

#[cfg(target_os = "windows")]
fn run_claude_install(claude_path: &str) -> Result<(i32, String), String> {
    let output = Command::new("cmd.exe")
        .args([
            "/c",
            &format!(
                "\"{}\" plugin install prism@prism-marketplace",
                claude_path
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to run cmd.exe: {}", e))?;

    let code = output.status.code().unwrap_or(-1);
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok((code, stderr))
}

#[cfg(target_os = "macos")]
fn run_claude_install(claude_path: &str) -> Result<(i32, String), String> {
    let output = Command::new(claude_path)
        .args(["plugin", "install", "prism@prism-marketplace"])
        .output()
        .map_err(|e| format!("Failed to run claude: {}", e))?;

    let code = output.status.code().unwrap_or(-1);
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok((code, stderr))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn run_claude_install(_claude_path: &str) -> Result<(i32, String), String> {
    Err("Unsupported platform".to_string())
}

/// Fallback: copy plugin files directly to ~/.claude/
fn install_plugin_file_copy(source_dir: &str) -> Result<String, String> {
    let home = home_dir().ok_or("Could not determine home directory")?;
    let claude_dir = home.join(".claude");

    // Create directories
    let commands_dest = claude_dir.join("commands");
    let agents_dest = claude_dir.join("agents");
    fs::create_dir_all(&commands_dest).map_err(|e| format!("mkdir commands: {}", e))?;
    fs::create_dir_all(&agents_dest).map_err(|e| format!("mkdir agents: {}", e))?;

    let source = PathBuf::from(source_dir);
    let mut copied = 0;

    // Copy commands
    let commands_src = source.join("commands");
    if commands_src.exists() {
        copied += copy_dir_contents(&commands_src, &commands_dest)?;
    }

    // Copy agents
    let agents_src = source.join("agents");
    if agents_src.exists() {
        copied += copy_dir_contents(&agents_src, &agents_dest)?;
    }

    Ok(format!(
        "Copied {} plugin files to {}",
        copied,
        claude_dir.display()
    ))
}

/// Recursively copy directory contents (non-recursive, single level).
fn copy_dir_contents(src: &std::path::Path, dest: &std::path::Path) -> Result<usize, String> {
    let entries =
        fs::read_dir(src).map_err(|e| format!("Read dir {}: {}", src.display(), e))?;

    let mut count = 0;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Read entry: {}", e))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("File type: {}", e))?;

        if file_type.is_file() {
            let dest_file = dest.join(entry.file_name());
            fs::copy(entry.path(), &dest_file)
                .map_err(|e| format!("Copy {}: {}", entry.path().display(), e))?;
            count += 1;
        }
    }

    Ok(count)
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

/// Install Claude plugin: try CLI first, fall back to file copy.
/// Accepts either a DetectedTool (preferred) or legacy claude_path string.
#[tauri::command]
pub fn install_plugin(
    claude_tool: Option<DetectedTool>,
    claude_path: Option<String>,
    source_dir: String,
) -> PluginInstallResult {
    // Extract the CLI path from DetectedTool or legacy string
    let effective_path = claude_tool
        .as_ref()
        .and_then(|tool| {
            tool.executable
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
                .or_else(|| tool.metadata.get("cli_path").cloned())
        })
        .or(claude_path);

    // Try CLI install if Claude path is available
    if let Some(ref path) = effective_path {
        match install_plugin_via_cli(path) {
            Ok(msg) => {
                return PluginInstallResult {
                    success: true,
                    method: "cli".to_string(),
                    message: msg,
                };
            }
            Err(e) => {
                // CLI failed, fall through to file copy
                eprintln!("Claude CLI install failed: {}. Falling back to file copy.", e);
            }
        }
    }

    // Fallback: file copy
    match install_plugin_file_copy(&source_dir) {
        Ok(msg) => PluginInstallResult {
            success: true,
            method: "file_copy".to_string(),
            message: msg,
        },
        Err(e) => PluginInstallResult {
            success: false,
            method: "file_copy".to_string(),
            message: format!("File copy fallback failed: {}", e),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_home_dir_returns_some() {
        assert!(home_dir().is_some());
    }

    #[test]
    fn test_install_plugin_no_claude_nonexistent_source() {
        let result = install_plugin(
            None,
            None,
            "/nonexistent/path/that/should/not/exist".to_string(),
        );
        // Should attempt file copy and succeed (with 0 files) or fail gracefully
        // Either way, method should be "file_copy"
        assert_eq!(result.method, "file_copy");
    }
}
