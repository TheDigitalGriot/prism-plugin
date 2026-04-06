import { BrowserWindow } from 'electron';
import type { ComponentId, InstallOptions, InstallProgress } from '../types';
import { installPrismCli, uninstallPrismCli } from './install-cli';
import { installVscodeExtension, uninstallVscodeExtension } from './install-vscode';
import { installClaudePlugin, uninstallClaudePlugin } from './install-plugin';
import { installElectronApp, uninstallElectronApp } from './install-electron';
import { getPrismBinDir } from './paths';

export class InstallerOrchestrator {
  private win: BrowserWindow;
  private abortController: AbortController;

  constructor(win: BrowserWindow) {
    this.win = win;
    this.abortController = new AbortController();
  }

  private sendProgress(progress: InstallProgress): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('setup:progress', progress);
    }
  }

  private makeProgressCallback(componentId: ComponentId): (p: InstallProgress) => void {
    return (p: InstallProgress) => {
      this.sendProgress({ ...p, componentId });
    };
  }

  async install(options: InstallOptions): Promise<void> {
    for (const componentId of options.components) {
      if (this.abortController.signal.aborted) {
        this.sendProgress({
          componentId,
          status: 'skipped',
          percent: 0,
          message: 'Cancelled',
        });
        continue;
      }

      try {
        await this.installComponent(componentId, options);
      } catch (err) {
        this.sendProgress({
          componentId,
          status: 'error',
          percent: 0,
          message: 'Unexpected error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async uninstall(components: ComponentId[]): Promise<void> {
    for (const componentId of components) {
      if (this.abortController.signal.aborted) {
        this.sendProgress({
          componentId,
          status: 'skipped',
          percent: 0,
          message: 'Cancelled',
        });
        continue;
      }

      try {
        await this.uninstallComponent(componentId, undefined);
      } catch (err) {
        this.sendProgress({
          componentId,
          status: 'error',
          percent: 0,
          message: 'Unexpected error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  cancel(): void {
    this.abortController.abort();
  }

  private async installComponent(id: ComponentId, options: InstallOptions): Promise<void> {
    const onProgress = this.makeProgressCallback(id);

    switch (id) {
      case 'prism-cli':
        await installPrismCli({
          installDir: options.installDir || getPrismBinDir(),
          addToPath: options.addToPath,
          onProgress,
        });
        break;

      case 'prism-vscode':
        if (options.editor) {
          await installVscodeExtension({
            editor: options.editor,
            onProgress,
          });
        } else {
          onProgress({
            componentId: id,
            status: 'skipped',
            percent: 0,
            message: 'No editor selected',
          });
        }
        break;

      case 'claude-plugin':
        await installClaudePlugin({ onProgress });
        break;

      case 'prism-electron':
        await installElectronApp({
          onProgress,
          signal: this.abortController.signal,
        });
        break;
    }
  }

  private async uninstallComponent(id: ComponentId, editor?: 'vscode' | 'cursor' | 'windsurf'): Promise<void> {
    const onProgress = this.makeProgressCallback(id);

    switch (id) {
      case 'prism-cli':
        await uninstallPrismCli(getPrismBinDir(), onProgress);
        break;

      case 'prism-vscode':
        await uninstallVscodeExtension(editor ?? 'vscode', onProgress);
        break;

      case 'claude-plugin':
        await uninstallClaudePlugin(onProgress);
        break;

      case 'prism-electron':
        await uninstallElectronApp(onProgress);
        break;
    }
  }
}
