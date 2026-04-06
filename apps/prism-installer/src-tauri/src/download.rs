use futures_util::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use tauri::ipc::Channel;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    Started { total: u64 },
    Progress { downloaded: u64, total: u64, percent: f64 },
    Finished { path: String },
    Error { message: String },
}

/// Construct the GitHub release download URL for the desktop app.
fn download_url(version: &str) -> String {
    let asset_name = if cfg!(target_os = "windows") {
        format!("Prism-{}.Setup.exe", version)
    } else {
        format!("Prism-{}.dmg", version)
    };

    format!(
        "https://github.com/TheDigitalGriot/prism-plugin/releases/download/v{}/{}",
        version,
        asset_name.replace(' ', "%20")
    )
}

/// Download the desktop app from GitHub releases with progress events.
#[tauri::command]
pub async fn download_desktop_app(
    version: String,
    on_progress: Channel<DownloadEvent>,
) -> Result<String, String> {
    let url = download_url(&version);

    let client = reqwest::Client::builder()
        .user_agent(format!("Prism-Setup/{}", version))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !response.status().is_success() {
        let msg = format!("Download failed: HTTP {}", response.status());
        let _ = on_progress.send(DownloadEvent::Error {
            message: msg.clone(),
        });
        return Err(msg);
    }

    let total = response.content_length().unwrap_or(0);
    let _ = on_progress.send(DownloadEvent::Started { total });

    // Determine temp file path
    let temp_dir = std::env::temp_dir();
    let filename = if cfg!(target_os = "windows") {
        "Prism-Desktop-Setup.exe"
    } else {
        "Prism-Desktop-Setup.dmg"
    };
    let temp_path = temp_dir.join(filename);

    // Stream download to file
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;

        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;
        let percent = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let _ = on_progress.send(DownloadEvent::Progress {
            downloaded,
            total,
            percent,
        });
    }

    let path_str = temp_path.to_string_lossy().to_string();
    let _ = on_progress.send(DownloadEvent::Finished {
        path: path_str.clone(),
    });

    Ok(path_str)
}

/// Run the downloaded installer silently.
#[tauri::command]
pub fn run_downloaded_installer(installer_path: String) -> Result<String, String> {
    let path = PathBuf::from(&installer_path);
    if !path.exists() {
        return Err(format!("Installer not found: {}", installer_path));
    }

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new(&installer_path)
            .arg("/S")
            .output()
            .map_err(|e| format!("Failed to run installer: {}", e))?;

        let code = output.status.code().unwrap_or(-1);
        if code == 0 {
            // Clean up temp file
            let _ = std::fs::remove_file(&path);
            Ok("Desktop app installed successfully".to_string())
        } else {
            Err(format!("Installer returned exit code {}", code))
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Mount DMG and copy .app to /Applications
        let output = std::process::Command::new("hdiutil")
            .args(["attach", &installer_path, "-nobrowse", "-quiet"])
            .output()
            .map_err(|e| format!("hdiutil attach failed: {}", e))?;

        if !output.status.success() {
            return Err("Failed to mount DMG".to_string());
        }

        // Find the mounted volume and copy .app
        let stdout = String::from_utf8_lossy(&output.stdout);
        let volume = stdout
            .lines()
            .last()
            .and_then(|line| line.split('\t').last())
            .map(|s| s.trim().to_string())
            .ok_or("Could not find mounted volume")?;

        let _ = std::process::Command::new("cp")
            .args(["-R", &format!("{}/Prism.app", volume), "/Applications/"])
            .output();

        let _ = std::process::Command::new("hdiutil")
            .args(["detach", &volume, "-quiet"])
            .output();

        let _ = std::fs::remove_file(&path);
        Ok("Desktop app installed to /Applications".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Unsupported platform for desktop app install".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_download_url_construction() {
        let url = download_url("2.4.6");
        assert!(url.contains("v2.4.6"));
        assert!(url.contains("github.com/TheDigitalGriot/prism-plugin"));

        #[cfg(target_os = "windows")]
        assert!(url.contains("Setup.exe"));
    }
}
