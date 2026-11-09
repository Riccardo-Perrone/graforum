import type { FileResult } from '@shared/ipc'
import { createEmptyProject } from '@shared/model'
import { importJson } from '@shared/export/exporter'
import { sampleProject } from '@shared/sample/locanda-del-corvo'
import { useProjectStore } from '../store/project'

// Azioni su file: nuovo, apri, salva, recenti.

const RECENT_KEY = 'graforum.recent'
const RECENT_LIMIT = 8

export interface RecentEntry {
  path: string
  name: string
  scenes: number
  openedAt: string
}

export function readRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentEntry[]
  } catch {
    return []
  }
}

function remember(result: Extract<FileResult, { ok: true }>): void {
  const entry: RecentEntry = {
    path: result.path,
    name: result.project.name,
    scenes: result.project.scenes.length,
    openedAt: new Date().toISOString()
  }
  try {
    const list = [entry, ...readRecent().filter((r) => r.path !== entry.path)].slice(0, RECENT_LIMIT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // elenco dei recenti non disponibile
  }
}

function handle(result: FileResult): void {
  if (result.ok) {
    useProjectStore.getState().load(result.project, result.path)
    remember(result)
    if (result.migrated) {
      const { from, backup } = result.migrated
      window.alert(`Il progetto era nel formato ${from} ed è stato aggiornato alla versione corrente.${backup ? `
L’originale è conservato in:
${backup}` : ''}`)
    }
  } else if (!result.canceled) {
    window.alert(`Impossibile aprire il progetto:\n${result.error}`)
  }
}

export async function newProject() {
  await window.graforum.resetImages()
  useProjectStore.getState().load(createEmptyProject('Nuovo progetto'), null)
}
export async function openSample() {
  await window.graforum.resetImages()
  useProjectStore.getState().load(sampleProject(), null)
}
export const openProject = async () => handle(await window.graforum.openProject())
export const openRecent = async (path: string) => handle(await window.graforum.openProjectAt(path))

/** Salva sul file corrente; senza file (o con `saveAs`) chiede dove salvare. */
export async function saveProject(saveAs = false): Promise<boolean> {
  const { project, filePath, revision } = useProjectStore.getState()
  if (!project) return false
  const result = await window.graforum.saveProject(project, saveAs ? null : filePath)
  if (result.ok) {
    useProjectStore.getState().markSaved(result.path, revision)
    remember(result)
    return true
  }
  if (!result.canceled) window.alert(`Salvataggio non riuscito:\n${result.error}`)
  return false
}

/** Importa un JSON (export o project.json) come nuovo progetto non salvato. */
export async function importProjectJson(): Promise<void> {
  const text = await window.graforum.importJson()
  if (text === null) return
  try {
    const project = importJson(text)
    await window.graforum.resetImages()
    useProjectStore.getState().load(project, null)
  } catch (err) {
    window.alert(`Importazione non riuscita:
${err instanceof Error ? err.message : String(err)}`)
  }
}
