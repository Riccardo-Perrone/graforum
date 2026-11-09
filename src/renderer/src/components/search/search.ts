import { create } from 'zustand'
import { buildUsageIndex, type EntityType, type Project, type SceneTag } from '@shared/model'
import { validate } from '@shared/engine'

// Ricerca globale e filtri combinabili: entrambi attenuano (o nascondono) le scene escluse, senza spostarle.

export interface SearchResult {
  type: EntityType
  id: string
  label: string
  sub: string
  /** Scena da evidenziare nel grafo. */
  sceneIds: string[]
  snippet?: string
}

function snippet(text: string, q: string): string | undefined {
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return undefined
  const start = Math.max(0, i - 24)
  return `${start > 0 ? '…' : ''}${text.slice(start, i + q.length + 32)}${i + q.length + 32 < text.length ? '…' : ''}`
}

export function search(p: Project, query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const usage = buildUsageIndex(p)
  const scenesOf = (id: string) =>
    (usage.get(id) ?? []).flatMap((o) => (o.type === 'scene' ? [o.id] : o.type === 'link' ? [p.links.find((l) => l.id === o.id)!.fromSceneId] : []))
  const out: SearchResult[] = []
  for (const s of p.scenes) {
    const inTitle = s.title.toLowerCase().includes(q)
    const sn = inTitle ? undefined : snippet(s.description, q)
    if (inTitle || sn) out.push({ type: 'scene', id: s.id, label: s.title, sub: inTitle ? 'titolo' : 'descrizione', sceneIds: [s.id], snippet: sn })
  }
  const cat = (type: EntityType, id: string, label: string, sub: string, extra = '') => {
    const sn = label.toLowerCase().includes(q) ? undefined : snippet(extra, q)
    if (label.toLowerCase().includes(q) || sn) out.push({ type, id, label, sub, sceneIds: scenesOf(id), snippet: sn })
  }
  p.npcs.forEach((n) => cat('npc', n.id, n.name, `NPC · ${n.role || '—'}`, `${n.description} ${n.background}`))
  p.enemies.forEach((n) => cat('enemy', n.id, n.name, `Enemy · ${n.level || '—'}`, n.description))
  p.items.forEach((i) => cat('item', i.id, i.name, 'Oggetto', i.description))
  p.quests.forEach((x) => cat('quest', x.id, x.title, `Quest · ${x.steps.length} step`, `${x.description} ${x.steps.map((s) => s.title).join(' ')}`))
  p.dialogs.forEach((d) => cat('dialog', d.id, d.title, 'Dialogo', d.lines.map((l) => `${l.text} ${l.choices.map((c) => c.text).join(' ')}`).join(' ')))
  p.documents.forEach((d) => cat('document', d.id, d.title, 'Documento', d.markdown))
  return out
}

export interface Filters {
  tags: SceneTag[]
  withConditions: boolean
  withChecks: boolean
  withProblems: boolean
  endingsOnly: boolean
  /** Entità che la scena deve usare (NPC, oggetto, quest, enemy…). */
  entity: { type: EntityType; id: string } | null
  groupId: string | null
  text: string
  hide: boolean
}

export const EMPTY_FILTERS: Filters = { tags: [], withConditions: false, withChecks: false, withProblems: false, endingsOnly: false, entity: null, groupId: null, text: '', hide: false }

export const filtersActive = (f: Filters) =>
  f.tags.length > 0 || f.withConditions || f.withChecks || f.withProblems || f.endingsOnly || !!f.entity || !!f.groupId || !!f.text.trim()

export function filterScenes(p: Project, f: Filters): Set<string> {
  const usage = buildUsageIndex(p)
  const problems = f.withProblems ? new Set(validate(p).filter((i) => i.severity !== 'note' && i.sceneId).map((i) => i.sceneId!)) : null
  const endings = new Set(p.endings.map((e) => e.sceneId))
  const groupIds = new Set<string>()
  if (f.groupId) {
    groupIds.add(f.groupId)
    for (let added = true; added; ) {
      added = false
      for (const g of p.groups) if (g.parentId && groupIds.has(g.parentId) && !groupIds.has(g.id)) (groupIds.add(g.id), (added = true))
    }
  }
  const entityScenes = f.entity
    ? new Set(
        (usage.get(f.entity.id) ?? []).flatMap((o) =>
          o.type === 'scene'
            ? [o.id]
            : o.type === 'link'
              ? [p.links.find((l) => l.id === o.id)!.fromSceneId]
              : o.type === 'dialog'
                ? p.scenes.filter((s) => s.npcs.some((n) => n.dialogs.some((d) => d.dialogId === o.id))).map((s) => s.id)
                : o.type === 'encounter'
                  ? p.scenes.filter((s) => s.encounterIds.includes(o.id)).map((s) => s.id)
                  : []
        )
      )
    : null
  const t = f.text.trim().toLowerCase()
  const ids = new Set<string>()
  for (const s of p.scenes) {
    if (f.tags.length && !f.tags.includes(s.tag)) continue
    if (f.withConditions && !JSON.stringify([s.access, s.items, s.npcs, p.links.filter((l) => l.fromSceneId === s.id).map((l) => l.gate)]).includes('"condition":{')) continue
    if (f.withChecks && !(s.entryCheck || s.items.some((i) => i.checks.length) || p.links.some((l) => l.fromSceneId === s.id && l.checks.length))) continue
    if (problems && !problems.has(s.id)) continue
    if (f.endingsOnly && !endings.has(s.id)) continue
    if (f.groupId && !(s.groupId && groupIds.has(s.groupId))) continue
    if (entityScenes && !entityScenes.has(s.id)) continue
    if (t && !`${s.title} ${s.description}`.toLowerCase().includes(t)) continue
    ids.add(s.id)
  }
  return ids
}

interface FilterState {
  filters: Filters
  saved: { name: string; filters: Filters }[]
  setFilters(f: Partial<Filters>): void
  reset(): void
  save(name: string): void
  remove(name: string): void
}

const SAVED_KEY = 'graforum.savedFilters'

export const useFilterStore = create<FilterState>((set, get) => ({
  filters: EMPTY_FILTERS,
  saved: (() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as { name: string; filters: Filters }[]
    } catch {
      return []
    }
  })(),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  reset: () => set({ filters: EMPTY_FILTERS }),
  save: (name) => {
    const saved = [...get().saved.filter((s) => s.name !== name), { name, filters: get().filters }]
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
    } catch {
      // viste non persistenti
    }
    set({ saved })
  },
  remove: (name) => {
    const saved = get().saved.filter((s) => s.name !== name)
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
    } catch {
      // viste non persistenti
    }
    set({ saved })
  }
}))
