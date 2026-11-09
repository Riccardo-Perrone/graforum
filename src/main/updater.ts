import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/ipc'

// Aggiornamento automatico dai rilasci GitHub (configurati in package.json › build.publish).
// L'utente controlla ogni passo: cerca, poi scarica con un pulsante, poi riavvia per installare.
// Funziona solo nell'app installata: in sviluppo lo stato resta «unsupported».

const MAX_NOTES = 600

let status: UpdateStatus = app.isPackaged ? { state: 'idle', currentVersion: app.getVersion() } : { state: 'unsupported', currentVersion: app.getVersion() }

function setStatus(patch: Partial<UpdateStatus> & Pick<UpdateStatus, 'state'>): void {
  status = { currentVersion: status.currentVersion, checkedAt: status.checkedAt, ...patch }
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send('update:status', status)
}

/** Testo semplice delle note di rilascio (GitHub le manda in HTML). */
export function plainNotes(notes: unknown): string | undefined {
  const text = typeof notes === 'string' ? notes : Array.isArray(notes) ? notes.map((n) => (n && typeof n === 'object' && 'note' in n ? String((n as { note: unknown }).note) : '')).join('\n') : ''
  const plain = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()
  if (!plain) return undefined
  return plain.length > MAX_NOTES ? `${plain.slice(0, MAX_NOTES).trimEnd()}…` : plain
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err)).split('\n')[0]!.slice(0, 200)

async function check(): Promise<void> {
  if (status.state === 'unsupported' || status.state === 'checking' || status.state === 'downloading' || status.state === 'ready') return
  setStatus({ state: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setStatus({ state: 'error', error: `Impossibile cercare gli aggiornamenti: ${errorText(err)}` })
  }
}

async function download(): Promise<void> {
  if (status.state !== 'available') return
  setStatus({ state: 'downloading', newVersion: status.newVersion, notes: status.notes, percent: 0 })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setStatus({ state: 'error', error: `Download non riuscito: ${errorText(err)}` })
  }
}

export function registerUpdater(): void {
  ipcMain.handle('update:status', () => status)
  ipcMain.handle('update:check', check)
  ipcMain.handle('update:download', download)
  ipcMain.on('update:install', () => {
    if (status.state === 'ready') autoUpdater.quitAndInstall()
  })
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  // Se l'utente non preme «Riavvia», l'aggiornamento scaricato si installa comunque alla chiusura.
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => setStatus({ state: 'available', newVersion: info.version, notes: plainNotes(info.releaseNotes), checkedAt: Date.now() }))
  autoUpdater.on('update-not-available', () => setStatus({ state: 'none', checkedAt: Date.now() }))
  autoUpdater.on('download-progress', (p) => setStatus({ state: 'downloading', newVersion: status.newVersion, notes: status.notes, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'ready', newVersion: info.version, notes: status.notes }))
  autoUpdater.on('error', (err) => setStatus({ state: 'error', error: `Aggiornamento non riuscito: ${errorText(err)}` }))
}
