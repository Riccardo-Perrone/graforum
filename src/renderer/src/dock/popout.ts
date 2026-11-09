import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import { addShortcutWindow } from '../lib/shortcuts'
import { effectiveTheme, useUiStore } from '../store/ui'

const POPOUT_URL = '/popout.html'

/** Allinea tema e dimensione del testo della finestra staccata a quelli dell'app. */
function syncAppearance(w: Window): void {
  const { theme, textScale } = useUiStore.getState()
  w.document.documentElement.dataset.theme = effectiveTheme(theme)
  w.document.documentElement.style.setProperty('--text-scale', String(textScale))
}

/**
 * Stacca la scheda (con il suo gruppo) in una finestra Electron vera. Il contenuto resta nello stesso contesto JS della finestra
 * principale: gli store sono condivisi, non serve sincronizzare nulla. Chiudendo la finestra la scheda torna nel dock.
 */
export function popoutPanel(api: DockviewApi, panel: IDockviewPanel): void {
  if (panel.api.location.type === 'popout') return
  // Dockview non stacca le schede delle aree laterali: prima passa al centro, accanto al grafo.
  if (panel.api.location.type === 'edge') {
    const host = api.getPanel('graph')
    if (!host) return
    panel.api.moveTo({ group: host.group, position: 'right' })
  }
  void api
    .addPopoutGroup(panel, {
      popoutUrl: POPOUT_URL,
      onDidOpen: ({ window: w }) => {
        const removeShortcuts = addShortcutWindow(w)
        const unsubscribe = useUiStore.subscribe(() => syncAppearance(w))
        w.addEventListener('load', () => syncAppearance(w))
        w.addEventListener('beforeunload', () => {
          removeShortcuts()
          unsubscribe()
        })
      }
    })
    .then((ok) => {
      // Se la finestra non si apre (bloccata) la scheda resta dov'era.
      if (!ok) console.warn('Finestra staccata non disponibile')
    })
}
