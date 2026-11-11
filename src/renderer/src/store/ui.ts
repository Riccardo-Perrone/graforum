import { create } from 'zustand'
import type { Theme } from '@shared/ipc'
import type { EntityType, Owner } from '@shared/model'
import type { SavedFilterView } from '../components/search/search'
import { dockBridge, type PanelId } from '../dock/bridge'
import { useProjectStore } from './project'

// Stato dell'interfaccia (non salvato nel progetto). Le preferenze restano nel browser storage dell'app.

const PREFS_KEY = 'graforum.prefs'

export interface Prefs {
  theme: Theme | 'system'
  /** Scala di pannelli, barre e finestre (1 = 100%). */
  uiScale: number
  /** Dimensione del testo rispetto alla base 13px. */
  textScale: number
  /** Aggancio dei nodi ai bordi e ai centri degli altri nodi durante il trascinamento. */
  snap: boolean
  /** Scorciatoie personalizzate: id del comando → combinazione ("" = nessuna). Le altre restano predefinite. */
  shortcuts: Record<string, string>
  /** Cerca da solo gli aggiornamenti all'avvio dell'app (la ricerca non scarica nulla). */
  autoCheckUpdates: boolean
  /** Disposizione delle schede (JSON di dockview); null = layout standard. Validato da `dock/layout.ts` al caricamento. */
  layout: unknown
  /** Viste salvate dei filtri del grafo (nome + filtri). */
  savedFilters: SavedFilterView[]
}

const DEFAULT_PREFS: Prefs = { theme: 'dark', uiScale: 1, textScale: 1, snap: true, shortcuts: {}, autoCheckUpdates: true, layout: null, savedFilters: [] }

/** Chiave con cui le versioni precedenti salvavano le viste dei filtri, fuori dalle preferenze: si legge una volta sola. */
const LEGACY_FILTERS_KEY = 'graforum.savedFilters'

function readLegacyFilters(): SavedFilterView[] {
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_FILTERS_KEY) ?? '[]') as unknown
    return Array.isArray(old) ? (old as SavedFilterView[]) : []
  } catch {
    return []
  }
}

function readPrefs(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>
    const shortcuts = Object.fromEntries(Object.entries(stored.shortcuts ?? {}).filter(([, v]) => typeof v === 'string'))
    const savedFilters = Array.isArray(stored.savedFilters) ? stored.savedFilters : readLegacyFilters()
    return { ...DEFAULT_PREFS, ...stored, shortcuts, savedFilters }
  } catch {
    return DEFAULT_PREFS
  }
}

const pickPrefs = (s: Prefs): Prefs => ({
  theme: s.theme,
  uiScale: s.uiScale,
  textScale: s.textScale,
  snap: s.snap,
  shortcuts: s.shortcuts,
  autoCheckUpdates: s.autoCheckUpdates,
  layout: s.layout,
  savedFilters: s.savedFilters
})

export type CatalogTab = 'all' | 'npc' | 'enemy' | 'item' | 'quest'
export type CatalogType = 'npc' | 'enemy' | 'item' | 'quest'
export type SettingsPage = 'general' | 'appearance' | 'skills' | 'itemTypes' | 'customFields' | 'conditionTypes' | 'endings' | 'flags' | 'shortcuts' | 'updates'
export type CrossTab = 'item' | 'quest' | 'progress' | 'npc' | 'enemy'

/** Scheda da aprire: `setView` la apre (o la porta in primo piano) nel dock. */
export type View =
  | { kind: 'graph' }
  | { kind: 'dialog'; dialogId: string }
  | { kind: 'dialogList' }
  | { kind: 'documents'; docId: string | null }
  | { kind: 'playtest'; startSceneId: string | null }

export interface DialogListState {
  npcId: string | null
  sceneId: string | null
  query: string
  groupBy: 'none' | 'npc' | 'scene'
}

/** Finestra aperta sopra il grafo. */
export type SheetState =
  | { kind: 'scene'; id: string }
  | { kind: 'catalog'; type: CatalogType; id: string }
  | { kind: 'settings'; page: SettingsPage }
  | { kind: 'images' }
  | { kind: 'cross'; tab: CrossTab; entityId?: string | null; scopeSceneId?: string | null; onlyPath?: boolean }
  | { kind: 'export' }
  | { kind: 'group'; id: string }
  | null

export interface Highlight {
  /** Scene in evidenza; le altre vengono attenuate (o nascoste). */
  sceneIds: Set<string>
  label: string
  hideOthers?: boolean
}

interface UiState extends Prefs {
  /** Schede aperte nel dock (aggiornato da DockHost). */
  openPanels: PanelId[]
  dialogList: DialogListState
  sheet: SheetState
  selectedSceneIds: string[]
  /** Carte di gruppi collassati selezionate nel grafo: contano come gruppi interi in "Raggruppa la selezione". */
  selectedCardIds: string[]
  /** Gruppo mostrato nel pannello a sinistra quando nessuna scena è selezionata. */
  selectedGroupId: string | null
  catalogTab: CatalogTab
  catalogQuery: string
  zoom: number
  highlight: Highlight | null
  pathEndingId: string | null
  /** Richiesta di centrare una scena nel grafo (nonce per ripeterla). */
  focus: { sceneId: string; nonce: number } | null
  searchOpen: boolean
  /** Eliminazione bloccata da mostrare (elenco "Usato in"). */
  blocked: { name: string; owners: Owner[] } | null

  setPrefs(p: Partial<Prefs>): void
  toggleTheme(): void
  setView(v: View): void
  setDialogList(p: Partial<DialogListState>): void
  openSheet(s: SheetState): void
  setOpenPanels(ids: PanelId[]): void
  setSelection(ids: string[]): void
  setSelectedCards(ids: string[]): void
  setSelectedGroup(id: string | null): void
  setCatalogTab(tab: CatalogTab): void
  setCatalogQuery(query: string): void
  setZoom(zoom: number): void
  setHighlight(h: Highlight | null): void
  setPathEnding(id: string | null): void
  focusScene(sceneId: string): void
  setSearchOpen(o: boolean): void
  showBlocked(b: { name: string; owners: Owner[] } | null): void
}

export const useUiStore = create<UiState>((set, get) => ({
  ...readPrefs(),
  openPanels: [],
  dialogList: { npcId: null, sceneId: null, query: '', groupBy: 'none' },
  sheet: null,
  selectedSceneIds: [],
  selectedCardIds: [],
  selectedGroupId: null,
  catalogTab: 'all',
  catalogQuery: '',
  zoom: 1,
  highlight: null,
  pathEndingId: null,
  focus: null,
  searchOpen: false,
  blocked: null,

  setPrefs: (p) => {
    const next = { ...pickPrefs(get()), ...p }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      // preferenze non persistenti: va bene comunque
    }
    set(next)
  },
  toggleTheme: () => get().setPrefs({ theme: effectiveTheme(get().theme) === 'dark' ? 'light' : 'dark' }),
  setView: (view) => {
    set({ sheet: null })
    switch (view.kind) {
      case 'graph':
        return dockBridge.openPanel?.('graph')
      case 'dialog':
        return dockBridge.openPanel?.('dialogs', { dialogId: view.dialogId })
      case 'dialogList':
        return dockBridge.openPanel?.('dialogs', { dialogId: null })
      case 'documents':
        return dockBridge.openPanel?.('documents', { docId: view.docId })
      case 'playtest':
        return dockBridge.openPanel?.('playtest', { startSceneId: view.startSceneId, nonce: Date.now() })
    }
  },
  setDialogList: (p) => set({ dialogList: { ...get().dialogList, ...p } }),
  openSheet: (sheet) => set({ sheet }),
  setOpenPanels: (openPanels) => set({ openPanels }),
  // Una selezione di scene impostata dall'app sostituisce anche le carte selezionate; il grafo le reimposta subito dopo se servono.
  setSelection: (selectedSceneIds) => set(selectedSceneIds.length ? { selectedSceneIds, selectedCardIds: [], selectedGroupId: null } : { selectedSceneIds, selectedCardIds: [] }),
  setSelectedCards: (selectedCardIds) => set({ selectedCardIds }),
  setSelectedGroup: (selectedGroupId) => set(selectedGroupId ? { selectedGroupId, selectedSceneIds: [] } : { selectedGroupId }),
  setCatalogTab: (catalogTab) => set({ catalogTab }),
  setCatalogQuery: (catalogQuery) => set({ catalogQuery }),
  setZoom: (zoom) => set({ zoom }),
  setHighlight: (highlight) => set({ highlight }),
  setPathEnding: (pathEndingId) => set({ pathEndingId }),
  focusScene: (sceneId) => set({ focus: { sceneId, nonce: Date.now() }, selectedSceneIds: [sceneId], selectedGroupId: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  showBlocked: (blocked) => set({ blocked })
}))

export function effectiveTheme(t: Prefs['theme']): Theme {
  if (t !== 'system') return t
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Apre la schermata giusta per qualsiasi entità (link di "Usato in", chip, risultati). */
export function openEntity(type: EntityType, id: string): void {
  const ui = useUiStore.getState()
  const p = useProjectStore.getState().project
  if (!p) return
  switch (type) {
    case 'scene':
      // La scena si inquadra nel grafo e si legge nella scheda "Scheda" (la apre se è chiusa).
      ui.focusScene(id)
      dockBridge.openPanel?.('inspector')
      return
    case 'npc':
    case 'enemy':
    case 'item':
    case 'quest':
      ui.openSheet({ kind: 'catalog', type, id })
      return
    case 'dialog':
      ui.setView({ kind: 'dialog', dialogId: id })
      return
    case 'document':
      ui.setView({ kind: 'documents', docId: id })
      return
    case 'link': {
      const l = p.links.find((x) => x.id === id)
      if (l) openEntity('scene', l.fromSceneId)
      return
    }
    case 'encounter': {
      const s = p.scenes.find((x) => x.encounterIds.includes(id))
      if (s) openEntity('scene', s.id)
      return
    }
    case 'ending': {
      const e = p.endings.find((x) => x.id === id)
      if (e) openEntity('scene', e.sceneId)
      return
    }
    case 'group':
      ui.setSelectedGroup(id)
      dockBridge.openPanel?.('inspector')
      return
    case 'step': {
      const q = p.quests.find((x) => x.steps.some((s) => s.id === id))
      if (q) openEntity('quest', q.id)
      return
    }
    case 'dialogLine':
    case 'dialogChoice': {
      const d = p.dialogs.find((x) => x.lines.some((l) => l.id === id || l.choices.some((c) => c.id === id)))
      if (d) ui.setView({ kind: 'dialog', dialogId: d.id })
      return
    }
    case 'flag':
      ui.openSheet({ kind: 'settings', page: 'flags' })
      return
    case 'image':
      ui.openSheet({ kind: 'images' })
      return
    case 'project':
      ui.openSheet({ kind: 'settings', page: 'general' })
      return
    default:
      return
  }
}
