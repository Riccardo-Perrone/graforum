import type { PanelId } from './bridge'

/** Titolo di ogni scheda, mostrato sulla linguetta e nel menu Finestra. */
export const PANEL_TITLES: Record<PanelId, string> = {
  graph: 'Grafo',
  inspector: 'Scheda',
  catalog: 'Catalogo',
  validation: 'Validazione',
  playtest: 'Playtest',
  dialogs: 'Dialoghi',
  documents: 'Documenti',
  library: 'Libreria'
}

/** Schede elencate nel menu Finestra e nel menu ⋯ dei gruppi. */
export const PANEL_LIST: { id: PanelId; title: string }[] = (Object.keys(PANEL_TITLES) as PanelId[])
  .map((id) => ({ id, title: PANEL_TITLES[id] }))

export const PANEL_IDS = Object.keys(PANEL_TITLES) as PanelId[]

/** Dove nasce una scheda quando si apre e non c'è già. */
export const PANEL_AREA: Record<PanelId, 'center' | 'left' | 'right' | 'bottom'> = {
  graph: 'center',
  inspector: 'left',
  catalog: 'right',
  validation: 'bottom',
  playtest: 'center',
  dialogs: 'center',
  documents: 'center',
  library: 'center'
}

/** Dimensione iniziale (px) dell'area quando una scheda ci viene aperta. */
export const AREA_SIZE = { left: 480, right: 320, bottom: 280 } as const
