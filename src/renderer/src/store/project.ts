import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'
import { create } from 'zustand'
import type { Project } from '@shared/model'

enablePatches()

interface HistoryEntry {
  label: string
  patches: Patch[]
  inverse: Patch[]
  /** Modifiche consecutive con la stessa chiave si uniscono in un solo passo di annulla. */
  mergeKey?: string
}

const HISTORY_LIMIT = 200

interface ProjectState {
  project: Project | null
  filePath: string | null
  /** Incrementa a ogni modifica: serve a capire se ci sono cambi non salvati. */
  revision: number
  savedRevision: number
  savedAt: Date | null
  past: HistoryEntry[]
  future: HistoryEntry[]

  load(project: Project, filePath: string | null): void
  close(): void
  /** Unico punto di modifica del progetto: ogni chiamata è annullabile. */
  apply(label: string, recipe: (draft: Draft<Project>) => void, mergeKey?: string): void
  undo(): void
  redo(): void
  markSaved(filePath: string, revision: number): void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  filePath: null,
  revision: 0,
  savedRevision: 0,
  savedAt: null,
  past: [],
  future: [],

  load: (project, filePath) =>
    set({ project, filePath, revision: 0, savedRevision: filePath ? 0 : -1, savedAt: null, past: [], future: [] }),

  close: () => set({ project: null, filePath: null, past: [], future: [] }),

  apply: (label, recipe, mergeKey) => {
    const { project, past, revision } = get()
    if (!project) return
    const [next, patches, inverse] = produceWithPatches(project, recipe)
    if (patches.length === 0) return
    const last = past.at(-1)
    const history =
      mergeKey && last?.mergeKey === mergeKey
        ? [...past.slice(0, -1), { ...last, patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse] }]
        : [...past, { label, patches, inverse, mergeKey }].slice(-HISTORY_LIMIT)
    set({ project: next, past: history, future: [], revision: revision + 1 })
  },

  undo: () => {
    const { project, past, future, revision } = get()
    const entry = past.at(-1)
    if (!project || !entry) return
    set({
      project: applyPatches(project, entry.inverse),
      past: past.slice(0, -1),
      future: [{ ...entry, mergeKey: undefined }, ...future],
      revision: revision + 1
    })
  },

  redo: () => {
    const { project, past, future, revision } = get()
    const entry = future[0]
    if (!project || !entry) return
    set({ project: applyPatches(project, entry.patches), past: [...past, entry], future: future.slice(1), revision: revision + 1 })
  },

  markSaved: (filePath, revision) => set({ filePath, savedRevision: revision, savedAt: new Date() })
}))

export const isDirty = (s: Pick<ProjectState, 'revision' | 'savedRevision'>) => s.revision !== s.savedRevision
