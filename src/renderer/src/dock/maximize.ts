import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import { AREAS, edgeId, type Area } from './layout'

/** Stato di una scheda ingrandita: da dove viene e quali aree laterali erano aperte, per rimettere tutto com'era. */
interface Maximized {
  panelId: string
  origin: { area: Area; index: number } | null
  openAreas: Area[]
}

let current: Maximized | null = null

const areaOf = (api: DockviewApi, panel: IDockviewPanel): Area | null => AREAS.find((a) => api.getEdgeGroup(a) && panel.group.id === edgeId(a)) ?? null

/**
 * Ingrandisce la scheda a tutta la finestra, come in Unity. Dockview ingrandisce solo i gruppi del centro e lascia le aree
 * laterali: qui si chiudono, e una scheda che sta in un'area passa temporaneamente al centro.
 */
export function maximizePanel(api: DockviewApi, panel: IDockviewPanel): void {
  if (current || panel.api.location.type === 'popout') return
  const origin = areaOf(api, panel)
  const openAreas = AREAS.filter((a) => api.getEdgeGroup(a)?.isCollapsed() === false)
  const state: Maximized = { panelId: panel.id, origin: origin ? { area: origin, index: panel.group.panels.indexOf(panel) } : null, openAreas }
  if (origin) {
    const host = api.getPanel('graph')
    if (!host) return
    panel.api.moveTo({ group: host.group, position: 'center' })
  }
  current = state
  panel.api.setActive()
  api.getPanel(panel.id)?.api.maximize()
  for (const a of AREAS) api.getEdgeGroup(a)?.collapse()
}

/** Annulla l'ingrandimento: la scheda torna al suo posto e le aree laterali si riaprono. */
export function restoreMaximized(api: DockviewApi): void {
  const state = current
  if (!state) return
  current = null
  if (api.hasMaximizedGroup()) api.exitMaximizedGroup()
  const panel = api.getPanel(state.panelId)
  if (panel && state.origin) {
    const group = api.groups.find((g) => g.id === edgeId(state.origin!.area))
    if (group) panel.api.moveTo({ group, index: state.origin.index })
  }
  for (const a of state.openAreas) api.getEdgeGroup(a)?.expand()
  api.getPanel(state.panelId)?.api.setActive()
}

export const isMaximizedPanel = (id: string): boolean => current?.panelId === id

/** Da richiamare quando il layout viene azzerato o ricaricato: lo stato ricordato non vale più. */
export function forgetMaximized(): void {
  current = null
}
