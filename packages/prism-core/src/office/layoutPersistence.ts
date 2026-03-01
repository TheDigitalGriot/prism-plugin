import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_POLL_INTERVAL_MS } from './constants';

export interface LayoutWatcher {
	markOwnWrite(): void;
	dispose(): void;
}

function getLayoutFilePath(): string {
	return path.join(os.homedir(), '.prism', 'office-layout.json');
}

export function readLayoutFromFile(): Record<string, unknown> | null {
	const filePath = getLayoutFilePath();
	try {
		if (!fs.existsSync(filePath)) return null;
		const raw = fs.readFileSync(filePath, 'utf-8');
		if (!raw || !raw.trim()) {
			console.warn('[Prism Office] Layout file is empty — ignoring');
			return null;
		}
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			console.warn('[Prism Office] Layout file contains invalid data (not an object) — ignoring');
			return null;
		}
		return parsed as Record<string, unknown>;
	} catch (err) {
		console.error('[Prism Office] Failed to read layout file (corrupted?) — using defaults:', err);
		// Rename the corrupted file so it doesn't block future writes
		try {
			const backupPath = filePath + '.corrupted.' + Date.now();
			fs.renameSync(filePath, backupPath);
			console.warn('[Prism Office] Moved corrupted layout file to:', backupPath);
		} catch { /* best-effort */ }
		return null;
	}
}

export function writeLayoutToFile(layout: Record<string, unknown>): void {
	const filePath = getLayoutFilePath();
	const dir = path.dirname(filePath);
	try {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const json = JSON.stringify(layout, null, 2);
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Prism Office] Failed to write layout file:', err);
	}
}

/**
 * Load layout using only file I/O (no platform-specific storage).
 * 1. If file exists → return it
 * 2. Else if defaultLayout provided → write to file, return it
 * 3. Else → return null
 *
 * VSCode-specific migration from workspaceState is handled in OfficeViewProvider.ts.
 */
export function loadLayout(
	defaultLayout?: Record<string, unknown> | null,
): Record<string, unknown> | null {
	// 1. Try file
	const fromFile = readLayoutFromFile();
	if (fromFile) {
		console.log('[Prism Office] Layout loaded from file');
		return fromFile;
	}

	// 2. Use bundled default
	if (defaultLayout) {
		console.log('[Prism Office] Writing bundled default layout to file');
		writeLayoutToFile(defaultLayout);
		return defaultLayout;
	}

	// 3. Nothing
	return null;
}

/**
 * Watch ~/.prism/office-layout.json for external changes (other VS Code windows).
 */
export function watchLayoutFile(
	onExternalChange: (layout: Record<string, unknown>) => void,
): LayoutWatcher {
	const filePath = getLayoutFilePath();
	let skipNextChange = false;
	let lastMtime = 0;
	let fsWatcher: fs.FSWatcher | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let disposed = false;

	// Initialize lastMtime
	try {
		if (fs.existsSync(filePath)) {
			lastMtime = fs.statSync(filePath).mtimeMs;
		}
	} catch { /* ignore */ }

	function checkForChange(): void {
		if (disposed) return;
		try {
			if (!fs.existsSync(filePath)) return;
			const stat = fs.statSync(filePath);
			if (stat.mtimeMs <= lastMtime) return;
			lastMtime = stat.mtimeMs;

			if (skipNextChange) {
				skipNextChange = false;
				return;
			}

			const raw = fs.readFileSync(filePath, 'utf-8');
			if (!raw || !raw.trim()) return;
			const parsed = JSON.parse(raw) as unknown;
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
			const layout = parsed as Record<string, unknown>;
			console.log('[Prism Office] External layout change detected');
			onExternalChange(layout);
		} catch (err) {
			console.error('[Prism Office] Error checking layout file:', err);
		}
	}

	function startFsWatch(): void {
		if (disposed || fsWatcher) return;
		try {
			if (!fs.existsSync(filePath)) return;
			fsWatcher = fs.watch(filePath, () => {
				checkForChange();
			});
			fsWatcher.on('error', () => {
				fsWatcher?.close();
				fsWatcher = null;
			});
		} catch {
			// File may not exist yet
		}
	}

	startFsWatch();

	pollTimer = setInterval(() => {
		if (disposed) return;
		if (!fsWatcher) {
			startFsWatch();
		}
		checkForChange();
	}, LAYOUT_FILE_POLL_INTERVAL_MS);

	return {
		markOwnWrite(): void {
			skipNextChange = true;
			try {
				if (fs.existsSync(filePath)) {
					lastMtime = fs.statSync(filePath).mtimeMs;
				}
			} catch { /* ignore */ }
		},
		dispose(): void {
			disposed = true;
			fsWatcher?.close();
			fsWatcher = null;
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
		},
	};
}
