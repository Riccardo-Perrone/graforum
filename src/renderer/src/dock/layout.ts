import type { DockviewApi, DockviewGroupPanel, SerializedDockview } from 'dockview-react'
import { PANEL_AREA, PANEL_IDS, PANEL_TITLES, AREA_SIZE } from './panelList'
import type { PanelId } from './bridge'

export type Area = 'left' | 'right' | 'bottom'
export const AREAS: Area[] = ['left', 'right', 'bottom']
export const edgeId = (area: Area) => `edge-${area}`

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Toglie le finestre staccate dal layout da salvare: all'avvio le schede staccate tornano a essere chiuse. */
export function stripPopouts(json: SerializedDockview): SerializedDockview {
  const popouts = json.popoutGroups ?? []
  if (!popouts.length) return json
  const gone = new Set<string>()
  for (const p of popouts) for (const id of (p.data as { views?: string[] }).views ?? []) gone.add(id)
  const panels = Object.fromEntries(Object.entries(json.panels).filter(([id]) => !gone.has(id)))
  return { ...json, panels, popoutGroups: [] }
}

/** Il layout salvato si usa solo se ha la forma giusta e contiene soltanto schede note, con il grafo presente. */
export function isUsableLayout(value: unknown): value is SerializedDockview {
  if (!isObject(value) || !isObject(value.grid) || !isObject(value.panels)) return false
  const panels = Object.entries(value.panels)
  if (!panels.some(([id]) => id === 'graph')) return false
  return panels.every(([id, p]) => isObject(p) && typeof p.contentComponent === 'string' && PANEL_IDS.includes(p.contentComponent as PanelId) && id === p.id)
}

/** Si assicura che esistano le tre aree laterali (collassate se vuote), anche dopo il caricamento di un layout salvato. */
export function ensureAreas(api: DockviewApi): void {
  for (const area of AREAS) {
    if (!api.getEdgeGroup(area)) {
      api.addEdgeGroup(area, { id: edgeId(area), initialSize: AREA_SIZE[area], minimumSize: area === 'bottom' ? 120 : 220, collapsed: true })
    }
  }
}

/** Gruppo del centro in cui riaprire le schede chiuse: quello del grafo o, se anche il grafo è chiuso, un qualsiasi gruppo del centro. */
function centerGroup(api: DockviewApi): DockviewGroupPanel | undefined {
  return api.getPanel('graph')?.group ?? api.groups.find((g) => g.api.location.type === 'grid')
}

/** Aggiunge una scheda nel gruppo indicato, o nel centro se non se ne indica uno. */
export function openPanelIn(api: DockviewApi, id: PanelId, params?: Record<string, unknown>, target?: DockviewGroupPanel): void {
  const base = { id, component: id, title: PANEL_TITLES[id], params }
  const group = target ?? centerGroup(api)
  api.addPanel(group ? { ...base, position: { referenceGroup: group, direction: 'within' } } : base)
  if (group?.api.isCollapsed()) group.api.expand()
}

/** Posto di partenza di una scheda nel layout standard: nell'area giusta (o nel centro, di fianco al grafo). */
export function addPanelTo(api: DockviewApi, id: PanelId, params?: Record<string, unknown>): void {
  const area = PANEL_AREA[id]
  const base = { id, component: id, title: PANEL_TITLES[id], params }
  if (area === 'center') return openPanelIn(api, id, params)
  api.addPanel({ ...base, position: { referenceGroup: edgeId(area), direction: 'within' } })
  const group = api.getEdgeGroup(area)
  if (group?.isCollapsed()) group.expand()
}

/** Layout standard, come in Unity: grafo al centro, scheda a sinistra, catalogo a destra, area in basso vuota e chiusa. */
export function applyDefaultLayout(api: DockviewApi): void {
  api.clear()
  api.addPanel({ id: 'graph', component: 'graph', title: PANEL_TITLES.graph })
  ensureAreas(api)
  for (const id of ['inspector', 'catalog'] as const) addPanelTo(api, id)
  api.getPanel('graph')?.api.setActive()
}
