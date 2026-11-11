import { useEffect, useReducer, useState } from 'react'
import { DockviewReact, type DockviewApi, type IDockviewPanel, type DockviewReadyEvent, type IDockviewHeaderActionsProps } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { Maximize2, Minimize2, SquareArrowOutUpRight } from 'lucide-react'
import { useCommand } from '../lib/shortcuts'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { IconButton } from '../components/ui/primitives'
import { dockBridge, type PanelId } from './bridge'
import { applyDefaultLayout, openPanelIn, ensureAreas, isUsableLayout, stripPopouts, type Area } from './layout'
import { forgetMaximized, isMaximizedPanel, maximizePanel, restoreMaximized } from './maximize'
import { PANEL_COMPONENTS } from './panels'
import { PanelMenu } from './PanelMenu'
import { popoutPanel } from './popout'

const SAVE_DELAY_MS = 300
const THEME = { name: 'graforum', className: 'dockview-theme-graforum', gap: 0, edgeGroupCollapsedSize: 30 }

/** Pulsanti a destra della linguetta: stacca in una finestra e ingrandisci/ripristina. */
function HeaderActions({ api, containerApi, activePanel, location, group, headerPosition }: IDockviewHeaderActionsProps) {
  // Il dock non ridisegna le azioni quando una scheda viene ingrandita o ripristinata.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const sub = containerApi.onDidMaximizedGroupChange(refresh)
    return () => sub.dispose()
  }, [containerApi])
  const maximized = api.isMaximized()
  const popped = location?.type === 'popout'
  // Nelle aree laterali la striscia delle linguette è verticale e stretta: le icone vanno una sotto l'altra.
  const vertical = headerPosition === 'left' || headerPosition === 'right'
  return (
    <div className={vertical ? 'flex w-full flex-col items-center gap-0.5 py-1' : 'flex h-full items-center gap-0.5 pr-1'}>
      <PanelMenu api={containerApi} group={group} />
      {!popped && (
        <IconButton
          icon={SquareArrowOutUpRight}
          size={12}
          className="size-6"
          title="Stacca la scheda in una finestra"
          onClick={() => activePanel && popoutPanel(containerApi, activePanel)}
        />
      )}
      <IconButton
        icon={maximized ? Minimize2 : Maximize2}
        size={12}
        className="size-6"
        title={maximized ? 'Ripristina la scheda' : 'Ingrandisci la scheda'}
        onClick={() => (maximized ? restoreMaximized(containerApi) : activePanel && maximizePanel(containerApi, activePanel))}
      />
    </div>
  )
}

/**
 * Collega il dock al resto dell'app: `dockBridge` (aprire, chiudere, ingrandire…), schede aperte nello store, salvataggio del layout.
 * Restituisce la funzione che scollega tutto. Si chiama da un effetto, così si ricollega anche quando React riesegue
 * gli effetti senza ricreare il dock (StrictMode, ricaricamento a caldo in sviluppo): altrimenti il ponte resterebbe vuoto
 * e menu, scorciatoie e pulsanti che aprono le schede non farebbero nulla.
 */
function connectDock(api: DockviewApi): () => void {
  // Ganci per le prove automatiche (scripts/smoke.cjs): non fanno parte dell'interfaccia dell'app.
  Object.assign(window, { graforumDock: api, graforumStores: { ui: useUiStore, project: useProjectStore } })

  const syncOpen = () => useUiStore.getState().setOpenPanels(api.panels.map((p) => p.id as PanelId))
  syncOpen()
  let timer: number | undefined
  const subs = [
    api.onDidAddPanel(syncOpen),
    api.onDidRemovePanel((p) => {
      syncOpen()
      if (p.id === 'validation') useUiStore.getState().setHighlight(null)
    }),
    api.onDidLayoutChange(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => useUiStore.getState().setPrefs({ layout: stripPopouts(api.toJSON()) }), SAVE_DELAY_MS)
    }),
    // Se la scheda viene ripristinata in altro modo (es. dal dock stesso), anche le aree laterali tornano com'erano.
    api.onDidMaximizedGroupChange((ev) => !ev.isMaximized && restoreMaximized(api))
  ]

  /** Porta la scheda in vista: toglie un ingrandimento che la nasconderebbe, apre l'area compressa che la contiene, la attiva. */
  const reveal = (panel: IDockviewPanel) => {
    if (api.hasMaximizedGroup() && !isMaximizedPanel(panel.id)) {
      restoreMaximized(api)
      if (api.hasMaximizedGroup()) api.exitMaximizedGroup()
    }
    const group = panel.group.api
    if (group.isCollapsed()) group.expand()
    panel.api.setActive()
    if (panel.api.location.type === 'popout') panel.api.getWindow().focus()
  }
  dockBridge.openPanel = (id, params) => {
    const existing = api.getPanel(id)
    if (existing) {
      if (params) existing.api.updateParameters(params)
      reveal(existing)
      return
    }
    // Una scheda chiusa si riapre nel centro, accanto alle altre.
    if (api.hasMaximizedGroup()) {
      restoreMaximized(api)
      if (api.hasMaximizedGroup()) api.exitMaximizedGroup()
    }
    openPanelIn(api, id, params)
    const added = api.getPanel(id)
    if (added) reveal(added)
  }
  dockBridge.closePanel = (id) => {
    const panel = api.getPanel(id)
    if (panel) api.removePanel(panel)
  }
  // Interruttore: chiude la scheda solo se è già quella in vista, altrimenti la apre o la porta in primo piano.
  dockBridge.togglePanel = (id) => {
    const panel = api.getPanel(id)
    const inView = panel && panel.api.isActive && !panel.group.api.isCollapsed() && !(api.hasMaximizedGroup() && !isMaximizedPanel(id))
    if (inView) dockBridge.closePanel?.(id)
    else dockBridge.openPanel?.(id)
  }
  dockBridge.resetLayout = () => {
    forgetMaximized()
    if (api.hasMaximizedGroup()) api.exitMaximizedGroup()
    applyDefaultLayout(api)
  }
  dockBridge.toggleMaximize = () => {
    const panel = api.activePanel
    if (!panel) return
    if (api.hasMaximizedGroup()) restoreMaximized(api)
    else maximizePanel(api, panel)
  }
  dockBridge.toggleArea = (area: Area) => {
    const group = api.getEdgeGroup(area)
    if (!group) return
    if (group.isCollapsed()) group.expand()
    else group.collapse()
  }
  dockBridge.popoutActive = () => {
    const panel = api.activePanel
    if (panel) popoutPanel(api, panel)
  }

  return () => {
    window.clearTimeout(timer)
    subs.forEach((s) => s.dispose())
    for (const key of Object.keys(dockBridge)) delete dockBridge[key as keyof typeof dockBridge]
    useUiStore.getState().setOpenPanels([])
  }
}

/** Il dock: grafo al centro e aree sinistra, destra e basso per tutte le altre schede, spostabili e staccabili. */
export function DockHost() {
  const [api, setApi] = useState<DockviewApi | null>(null)

  // Solo alla nascita del dock: layout salvato o standard. Il collegamento al resto dell'app sta nell'effetto sotto.
  const onReady = (e: DockviewReadyEvent) => {
    const saved = useUiStore.getState().layout
    let loaded = false
    if (isUsableLayout(saved)) {
      try {
        e.api.fromJSON(saved)
        ensureAreas(e.api)
        loaded = true
      } catch {
        // layout salvato non più leggibile: si riparte da quello standard
      }
    }
    if (!loaded) applyDefaultLayout(e.api)
    setApi(e.api)
  }

  useEffect(() => (api ? connectDock(api) : undefined), [api])

  useCommand('backToGraph', () => dockBridge.openPanel?.('graph'))
  useCommand('resetLayout', () => dockBridge.resetLayout?.())
  useCommand('togglePanelMaximize', () => dockBridge.toggleMaximize?.())
  useCommand('popoutPanel', () => dockBridge.popoutActive?.())
  useCommand('toggleLeftArea', () => dockBridge.toggleArea?.('left'))
  useCommand('toggleRightArea', () => dockBridge.toggleArea?.('right'))
  useCommand('toggleBottomArea', () => dockBridge.toggleArea?.('bottom'))
  useCommand('openInspector', () => dockBridge.openPanel?.('inspector'))
  useCommand('toggleCatalog', () => dockBridge.togglePanel?.('catalog'))

  return (
    // `isolate`: lo strato delle schede (z-index 999 di dockview) resta sotto finestre, menu e conferme dell'app.
    <div className="isolate min-h-0 flex-1">
      <DockviewReact className="h-full" components={PANEL_COMPONENTS} theme={THEME} defaultRenderer="always" rightHeaderActionsComponent={HeaderActions} onReady={onReady} />
    </div>
  )
}
