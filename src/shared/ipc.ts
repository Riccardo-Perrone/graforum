import type { Project } from './model'

/** Esito dell'apertura o del salvataggio di un file `.dng`. */
export type FileResult =
  | { ok: true; path: string; project: Project; migrated?: { from: number; backup: string | null } }
  | { ok: false; canceled: true }
  | { ok: false; canceled: false; error: string }

export type Theme = 'dark' | 'light'

export interface ImportedImage {
  id: string
  fileName: string
  mime: string
}

export interface ExportFile {
  defaultName: string
  filters: { name: string; extensions: string[] }[]
  content: string | Uint8Array
}

/** Stato dell'aggiornamento automatico (solo l'app installata può aggiornarsi). */
export interface UpdateStatus {
  state: 'unsupported' | 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'
  currentVersion: string
  /** Versione trovata (available, downloading, ready). */
  newVersion?: string
  /** Note di rilascio in testo semplice. */
  notes?: string
  /** Avanzamento del download, 0–100. */
  percent?: number
  error?: string
  /** Ultimo controllo concluso (ms da epoch). */
  checkedAt?: number
}

/** API esposta dal preload al renderer come `window.graforum`. */
export interface GraforumApi {
  openProject(): Promise<FileResult>
  openProjectAt(path: string): Promise<FileResult>
  saveProject(project: Project, path: string | null): Promise<FileResult>
  /** Svuota la libreria in memoria (nuovo progetto o esempio). */
  resetImages(): Promise<void>
  importImages(): Promise<ImportedImage[]>
  exportFile(file: ExportFile): Promise<string | null>
  exportZip(defaultName: string, files: Record<string, string>, images: { id: string; fileName: string }[]): Promise<string | null>
  exportPdf(html: string, defaultName: string): Promise<string | null>
  importJson(): Promise<string | null>
  showItemInFolder(path: string): Promise<void>
  setTheme(theme: Theme): void
  setZoom(factor: number): void
  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  /** Chiude l'app e installa l'aggiornamento già scaricato. */
  installUpdate(): void
  /** Riceve ogni cambio di stato; restituisce la funzione per smettere di ascoltare. */
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
}

export const imageUrl = (id: string) => `graforum-img://lib/${encodeURIComponent(id)}`
