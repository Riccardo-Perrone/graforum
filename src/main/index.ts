import { readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { strToU8, zipSync } from 'fflate'
import type { ExportFile, FileResult, ImportedImage, Theme } from '@shared/ipc'
import { newId, type Project } from '@shared/model'
import { registerUpdater } from './updater'
import { backupBeforeMigration, imageEntryName, readProjectFile, writeProjectFile, type ImageFiles } from './projectFile'

const TITLE_BAR_HEIGHT = 36
const OVERLAY: Record<Theme, Electron.TitleBarOverlayOptions> = {
  dark: { color: '#111419', symbolColor: '#a1a7b2', height: TITLE_BAR_HEIGHT },
  light: { color: '#ffffff', symbolColor: '#4b5260', height: TITLE_BAR_HEIGHT }
}
const DNG_FILTER = [{ name: 'Progetto Graforum', extensions: ['dng'] }]
const IMAGE_EXT: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' }

/** Immagini del progetto aperto: restano in memoria e finiscono nel .dng al salvataggio. */
let images: ImageFiles = new Map()

const APP_SCHEME = 'graforum-app'
const RENDERER_DIR = join(__dirname, '../renderer')
const DEV_URL = process.env['ELECTRON_RENDERER_URL']

protocol.registerSchemesAsPrivileged([
  { scheme: 'graforum-img', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  // L'app compilata si carica da qui e non da file://: le schede staccate (window.open) richiedono un'origine uguale a quella della pagina.
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

/** Origine da cui si carica l'interfaccia (server di sviluppo oppure il protocollo dell'app compilata). */
const appOrigin = () => (DEV_URL ? new URL(DEV_URL).origin : `${APP_SCHEME}://app`)

/**
 * Le schede staccate dal dock aprono una finestra con window.open sulla pagina vuota popout.html dell'app: la si consente,
 * con la stessa sicurezza della principale. Ogni altro indirizzo si apre nel browser di sistema.
 */
function watchWindowOpen(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === `${appOrigin()}/popout.html`) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 900, height: 700, minWidth: 360, minHeight: 240, autoHideMenuBar: true, backgroundColor: '#0b0d11', title: 'Graforum' }
      }
    }
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-create-window', (child) => {
    child.setMenuBarVisibility(false)
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b0d11',
    // Nell'app installata l'icona è quella dell'eseguibile; in sviluppo la si imposta qui.
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../build/icon.png') }),
    // Barra del titolo disegnata dall'app; i controlli finestra restano nativi (snap layout di Windows 11).
    titleBarStyle: 'hidden',
    titleBarOverlay: OVERLAY.dark,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win.show())
  watchWindowOpen(win)
  if (DEV_URL) void win.loadURL(DEV_URL)
  else void win.loadURL(`${APP_SCHEME}://app/index.html`)
  return win
}

const errorResult = (err: unknown): FileResult => ({ ok: false, canceled: false, error: err instanceof Error ? err.message : String(err) })

async function open(path: string): Promise<FileResult> {
  try {
    const result = await readProjectFile(path)
    images = result.images
    app.addRecentDocument(path)
    // File di una versione precedente: ne resta una copia originale prima che il salvataggio lo riscriva.
    const migrated = result.migratedFrom === null ? undefined : { from: result.migratedFrom, backup: await backupBeforeMigration(path, result.migratedFrom) }
    return { ok: true, path, project: result.project, migrated }
  } catch (err) {
    return errorResult(err)
  }
}

const winOf = (e: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender)!

function registerIpc(): void {
  ipcMain.handle('project:open', async (event): Promise<FileResult> => {
    const res = await dialog.showOpenDialog(winOf(event), { filters: DNG_FILTER, properties: ['openFile'] })
    const path = res.filePaths[0]
    if (res.canceled || !path) return { ok: false, canceled: true }
    return open(path)
  })

  ipcMain.handle('project:openAt', (_event, path: string) => open(path))

  ipcMain.handle('project:save', async (event, project: Project, path: string | null): Promise<FileResult> => {
    let target = path
    if (!target) {
      const res = await dialog.showSaveDialog(winOf(event), { filters: DNG_FILTER, defaultPath: `${project.name}.dng` })
      if (res.canceled || !res.filePath) return { ok: false, canceled: true }
      target = res.filePath
    }
    try {
      await writeProjectFile(target, project, images)
      app.addRecentDocument(target)
      return { ok: true, path: target, project }
    } catch (err) {
      return errorResult(err)
    }
  })

  ipcMain.handle('images:reset', () => {
    images = new Map()
  })

  ipcMain.handle('images:import', async (event): Promise<ImportedImage[]> => {
    const res = await dialog.showOpenDialog(winOf(event), {
      title: 'Carica immagini nella libreria',
      filters: [{ name: 'Immagini', extensions: Object.keys(IMAGE_EXT).map((e) => e.slice(1)) }],
      properties: ['openFile', 'multiSelections']
    })
    if (res.canceled) return []
    const out: ImportedImage[] = []
    for (const path of res.filePaths) {
      const mime = IMAGE_EXT[extname(path).toLowerCase()]
      if (!mime) continue
      const id = newId('image')
      const fileName = basename(path)
      images.set(id, { data: new Uint8Array(await readFile(path)), fileName })
      out.push({ id, fileName, mime })
    }
    return out
  })

  ipcMain.handle('export:file', async (event, file: ExportFile): Promise<string | null> => {
    const res = await dialog.showSaveDialog(winOf(event), { defaultPath: file.defaultName, filters: file.filters })
    if (res.canceled || !res.filePath) return null
    await writeFile(res.filePath, typeof file.content === 'string' ? file.content : Buffer.from(file.content))
    return res.filePath
  })

  ipcMain.handle('export:zip', async (event, defaultName: string, files: Record<string, string>, imageIds: { id: string; fileName: string }[]): Promise<string | null> => {
    const res = await dialog.showSaveDialog(winOf(event), { defaultPath: defaultName, filters: [{ name: 'Archivio zip', extensions: ['zip'] }] })
    if (res.canceled || !res.filePath) return null
    const entries: Record<string, Uint8Array> = {}
    for (const [name, text] of Object.entries(files)) entries[name] = strToU8(text)
    for (const img of imageIds) {
      const file = images.get(img.id)
      if (file) entries[imageEntryName(img.id, img.fileName)] = file.data
    }
    await writeFile(res.filePath, zipSync(entries, { level: 6 }))
    return res.filePath
  })

  ipcMain.handle('export:pdf', async (event, html: string, defaultName: string): Promise<string | null> => {
    const res = await dialog.showSaveDialog(winOf(event), { defaultPath: defaultName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (res.canceled || !res.filePath) return null
    const printer = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    try {
      await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await printer.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
      await writeFile(res.filePath, pdf)
      return res.filePath
    } finally {
      printer.destroy()
    }
  })

  ipcMain.handle('import:json', async (event): Promise<string | null> => {
    const res = await dialog.showOpenDialog(winOf(event), { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
    const path = res.filePaths[0]
    if (res.canceled || !path) return null
    return readFile(path, 'utf8')
  })

  ipcMain.handle('shell:showItem', (_event, path: string) => shell.showItemInFolder(path))

  ipcMain.on('window:setTheme', (event, theme: Theme) => {
    BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay(OVERLAY[theme])
  })

  ipcMain.on('window:setZoom', (event, factor: number) => {
    event.sender.setZoomFactor(factor)
  })
}

app.whenReady().then(() => {
  // Le immagini della libreria si leggono come graforum-img://lib/<id> (il percorso conserva le maiuscole).
  protocol.handle('graforum-img', (request) => {
    const id = decodeURIComponent(new URL(request.url).pathname.slice(1))
    const file = images.get(id)
    if (!file) return new Response(null, { status: 404 })
    const mime = IMAGE_EXT[extname(file.fileName).toLowerCase()] ?? 'application/octet-stream'
    return new Response(Buffer.from(file.data), { headers: { 'content-type': mime } })
  })
  // Interfaccia compilata: i file di out/renderer si servono dal protocollo dell'app (con un controllo che non si esca dalla cartella).
  protocol.handle(APP_SCHEME, async (request) => {
    const path = decodeURIComponent(new URL(request.url).pathname) || '/index.html'
    const file = join(RENDERER_DIR, path === '/' ? 'index.html' : path)
    if (!file.startsWith(RENDERER_DIR)) return new Response(null, { status: 403 })
    return net.fetch(pathToFileURL(file).toString())
  })
  registerIpc()
  registerUpdater()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
