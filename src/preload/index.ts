import { contextBridge, ipcRenderer } from 'electron'
import type { GraforumApi, UpdateStatus } from '@shared/ipc'

const api: GraforumApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectAt: (path) => ipcRenderer.invoke('project:openAt', path),
  saveProject: (project, path) => ipcRenderer.invoke('project:save', project, path),
  resetImages: () => ipcRenderer.invoke('images:reset'),
  importImages: () => ipcRenderer.invoke('images:import'),
  importSounds: () => ipcRenderer.invoke('sounds:import'),
  exportFile: (file) => ipcRenderer.invoke('export:file', file),
  exportZip: (name, files, media) => ipcRenderer.invoke('export:zip', name, files, media),
  exportPdf: (html, name) => ipcRenderer.invoke('export:pdf', html, name),
  importJson: () => ipcRenderer.invoke('import:json'),
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItem', path),
  setTheme: (theme) => ipcRenderer.send('window:setTheme', theme),
  setZoom: (factor) => ipcRenderer.send('window:setZoom', factor),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdateStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => listener(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  }
}

contextBridge.exposeInMainWorld('graforum', api)
