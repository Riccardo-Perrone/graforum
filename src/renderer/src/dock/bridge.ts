// Ponte tra store/comandi e il dock delle schede: DockHost compila questi gestori quando è montato.
// Sta in un file a sé, senza importi, per evitare cicli (le schede importano lo store, lo store apre le schede).

export type PanelId = 'graph' | 'inspector' | 'catalog' | 'validation' | 'playtest' | 'dialogs' | 'documents' | 'library'

export interface DockBridge {
  /** Apre la scheda (o la porta in primo piano); `params` aggiorna i parametri di una scheda già aperta. */
  openPanel?(id: PanelId, params?: Record<string, unknown>): void
  closePanel?(id: PanelId): void
  togglePanel?(id: PanelId): void
  resetLayout?(): void
  toggleMaximize?(): void
  toggleArea?(area: 'left' | 'right' | 'bottom'): void
  popoutActive?(): void
}

export const dockBridge: DockBridge = {}
