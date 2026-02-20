# electron-updater API Reference

## Quick Reference

### Installation
```bash
npm install electron-updater
```

### Basic Usage
```typescript
import { autoUpdater } from 'electron-updater';

// Check for updates
autoUpdater.checkForUpdatesAndNotify();

// Or check without auto-notification
autoUpdater.checkForUpdates();
```

### Events
| Event | Description |
|-------|-------------|
| `checking-for-update` | Emitted when checking starts |
| `update-available` | Update found, info object contains version |
| `update-not-available` | Already on latest version |
| `download-progress` | Progress object with percent, bytesPerSecond, total, transferred |
| `update-downloaded` | Download complete, ready to install |
| `error` | Error during update process |

### Methods
| Method | Description |
|--------|-------------|
| `checkForUpdates()` | Check for updates, returns Promise |
| `checkForUpdatesAndNotify()` | Check and show native notification |
| `downloadUpdate()` | Download available update |
| `quitAndInstall()` | Quit app and install update |

### Configuration
```typescript
autoUpdater.autoDownload = false;      // Don't auto-download
autoUpdater.autoInstallOnAppQuit = true; // Install on quit
autoUpdater.allowPrerelease = false;    // Skip pre-releases
autoUpdater.channel = 'latest';         // Update channel
```

### GitHub Releases Setup (Electron Forge)
```typescript
// forge.config.ts
publishers: [{
  name: '@electron-forge/publisher-github',
  config: {
    repository: { owner: 'user', name: 'repo' },
    prerelease: false,
    draft: true
  }
}]
```
