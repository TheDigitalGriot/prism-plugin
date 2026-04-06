import { contextBridge, ipcRenderer } from 'electron';
import type { InstallOptions, ComponentId, InstallProgress } from './types';

contextBridge.exposeInMainWorld('setupAPI', {
  getSystemInfo: () => ipcRenderer.invoke('setup:getSystemInfo'),
  startInstall: (options: InstallOptions) => ipcRenderer.invoke('setup:startInstall', options),
  startUninstall: (components: ComponentId[]) => ipcRenderer.invoke('setup:startUninstall', components),
  cancelInstall: () => ipcRenderer.send('setup:cancelInstall'),
  onProgress: (cb: (progress: InstallProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: InstallProgress) => cb(p);
    ipcRenderer.on('setup:progress', handler);
    return () => { ipcRenderer.removeListener('setup:progress', handler); };
  },
  openExternal: (url: string) => ipcRenderer.invoke('setup:openExternal', url),
  selectDirectory: (defaultPath: string) => ipcRenderer.invoke('setup:selectDirectory', defaultPath),
  getLatestVersion: () => ipcRenderer.invoke('setup:getLatestVersion'),
});
