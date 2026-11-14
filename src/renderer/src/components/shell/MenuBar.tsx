import { useState } from 'react'
import { importProjectJson, newProject, openProject, openSample, saveProject } from '../../lib/fileActions'
import { canGroupSelection, groupSelection } from '../../lib/sceneOps'
import { kbdLabel } from '../../lib/commands'
import { useCommand } from '../../lib/shortcuts'
import { playFromStart } from '../../lib/playtest'
import { useProjectStore } from '../../store/project'
import { dockBridge, type PanelId } from '../../dock/bridge'
import { PANEL_LIST } from '../../dock/panelList'
import { useUiStore, type View } from '../../store/ui'
import { useClickOutside } from '../ui/form'
import { Kbd, cn } from '../ui/primitives'

interface Item {
  label: string
  kbd?: string
  run?: () => void
  disabled?: boolean
  separator?: boolean
  heading?: boolean
}

const ui = () => useUiStore.getState()
const sep: Item = { label: '', separator: true }

function menus(hasProject: boolean, canUndo: boolean, canRedo: boolean, canPlay: boolean): [string, Item[]][] {
  const needs = !hasProject
  const view = (v: View) => () => ui().setView(v)
  return [
    [
      'File',
      [
        { label: 'Nuovo progetto', kbd: kbdLabel('newProject'), run: () => void newProject() },
        { label: 'Apri…', kbd: kbdLabel('openProject'), run: () => void openProject() },
        { label: 'Apri l’esempio', run: () => void openSample() },
        sep,
        { label: 'Salva', kbd: kbdLabel('save'), run: () => void saveProject(), disabled: needs },
        { label: 'Salva con nome…', kbd: kbdLabel('saveAs'), run: () => void saveProject(true), disabled: needs },
        sep,
        { label: 'Importa JSON…', run: () => void importProjectJson() },
        { label: 'Esporta…', kbd: kbdLabel('export'), run: () => ui().openSheet({ kind: 'export' }), disabled: needs },
        sep,
        { label: 'Chiudi progetto', run: () => (ui().setView({ kind: 'graph' }), ui().openSheet(null), useProjectStore.getState().close()), disabled: needs }
      ]
    ],
    [
      'Modifica',
      [
        { label: 'Annulla', kbd: kbdLabel('undo'), run: () => useProjectStore.getState().undo(), disabled: !canUndo },
        { label: 'Ripeti', kbd: kbdLabel('redo'), run: () => useProjectStore.getState().redo(), disabled: !canRedo },
        sep,
        { label: 'Raggruppa la selezione', kbd: kbdLabel('groupSelection'), run: () => void groupSelection(), disabled: needs || !canGroupSelection() },
        { label: 'Libreria media', run: view({ kind: 'library', tab: 'images' }), disabled: needs },
        { label: 'Libreria suoni', run: view({ kind: 'library', tab: 'sounds' }), disabled: needs }
      ]
    ],
    [
      'Vista',
      [
        { label: 'Grafo', run: view({ kind: 'graph' }), disabled: needs },
        { label: 'Documenti', kbd: kbdLabel('documents'), run: () => dockBridge.openPanel?.('documents'), disabled: needs },
        { label: 'Libreria', kbd: kbdLabel('library'), run: () => dockBridge.openPanel?.('library'), disabled: needs },
        { label: 'Dialoghi', kbd: kbdLabel('dialogList'), run: () => dockBridge.openPanel?.('dialogs'), disabled: needs },
        { label: 'Pannello catalogo', kbd: kbdLabel('toggleCatalog'), run: () => dockBridge.openPanel?.('catalog'), disabled: needs },
        { label: 'Validazione', kbd: kbdLabel('toggleValidation'), run: () => dockBridge.openPanel?.('validation'), disabled: needs },
        sep,
        { label: 'VISTE INCROCIATE', heading: true },
        { label: 'Dove serve un oggetto', run: () => ui().openSheet({ kind: 'cross', tab: 'item' }), disabled: needs },
        { label: 'Quest nel grafo', run: () => ui().openSheet({ kind: 'cross', tab: 'quest' }), disabled: needs },
        { label: 'NPC', run: () => ui().openSheet({ kind: 'cross', tab: 'npc' }), disabled: needs },
        { label: 'Enemy', run: () => ui().openSheet({ kind: 'cross', tab: 'enemy' }), disabled: needs },
        { label: 'Avanzamento', kbd: kbdLabel('crossProgress'), run: () => ui().openSheet({ kind: 'cross', tab: 'progress' }), disabled: needs },
        sep,
        { label: 'Cambia tema', kbd: kbdLabel('toggleTheme'), run: () => ui().toggleTheme() }
      ]
    ],
    [
      'Finestra',
      [
        { label: 'SCHEDE', heading: true },
        ...PANEL_LIST.map(({ id, title }): Item => ({ label: `${ui().openPanels.includes(id as PanelId) ? '✓ ' : '    '}${title}`, run: () => dockBridge.openPanel?.(id as PanelId), disabled: needs })),
        sep,
        { label: 'Ingrandisci / ripristina la scheda', kbd: kbdLabel('togglePanelMaximize'), run: () => dockBridge.toggleMaximize?.(), disabled: needs },
        { label: 'Stacca la scheda in una finestra', kbd: kbdLabel('popoutPanel'), run: () => dockBridge.popoutActive?.(), disabled: needs },
        sep,
        { label: 'Mostra / nascondi area sinistra', kbd: kbdLabel('toggleLeftArea'), run: () => dockBridge.toggleArea?.('left'), disabled: needs },
        { label: 'Mostra / nascondi area destra', kbd: kbdLabel('toggleRightArea'), run: () => dockBridge.toggleArea?.('right'), disabled: needs },
        { label: 'Mostra / nascondi area in basso', kbd: kbdLabel('toggleBottomArea'), run: () => dockBridge.toggleArea?.('bottom'), disabled: needs },
        sep,
        { label: 'Layout standard', kbd: kbdLabel('resetLayout'), run: () => dockBridge.resetLayout?.(), disabled: needs }
      ]
    ],
    [
      'Progetto',
      [
        { label: 'Impostazioni', run: () => ui().openSheet({ kind: 'settings', page: 'general' }), disabled: needs },
        { label: 'Finali', run: () => ui().openSheet({ kind: 'settings', page: 'endings' }), disabled: needs },
        { label: 'Abilità', run: () => ui().openSheet({ kind: 'settings', page: 'skills' }), disabled: needs },
        { label: 'Flag', run: () => ui().openSheet({ kind: 'settings', page: 'flags' }), disabled: needs },
        sep,
        { label: 'Playtest', kbd: kbdLabel('playFromStart'), run: playFromStart, disabled: needs || !canPlay },
        { label: 'Esporta…', kbd: kbdLabel('export'), run: () => ui().openSheet({ kind: 'export' }), disabled: needs }
      ]
    ],
    [
      'Aiuto',
      [
        { label: 'Scorciatoie da tastiera', run: () => ui().openSheet({ kind: 'settings', page: 'shortcuts' }), disabled: needs },
        { label: 'Aspetto e scala', run: () => ui().openSheet({ kind: 'settings', page: 'appearance' }), disabled: needs },
        { label: 'Informazioni su Graforum', run: () => window.alert('Graforum 0.1 — editor di grafo narrativo D&D') }
      ]
    ]
  ]
}

/** Menu File / Modifica / Vista / Progetto / Aiuto della barra del titolo. */
export function MenuBar() {
  const hasProject = useProjectStore((s) => s.project !== null)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  const canPlay = useProjectStore((s) => !!s.project?.startSceneId)
  const [open, setOpen] = useState<string | null>(null)
  const ref = useClickOutside<HTMLElement>(() => setOpen(null), open !== null)
  useCommand('export', () => hasProject && ui().openSheet({ kind: 'export' }))
  useUiStore((st) => st.shortcuts) // ridisegna i menu quando cambiano le scorciatoie
  useUiStore((st) => st.openPanels) // e quando si aprono o chiudono le schede
  const list = menus(hasProject, canUndo, canRedo, canPlay)

  return (
    <nav ref={ref} className="no-drag relative flex gap-0.5 text-[12.5px] text-tx2">
      {list.map(([name, items]) => (
        <div key={name} className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === name ? null : name)}
            onMouseEnter={() => open && setOpen(name)}
            className={cn('rounded-[5px] px-2 py-1 hover:bg-hover hover:text-tx', open === name && 'bg-hover text-tx')}
          >
            {name}
          </button>
          {open === name && (
            <div className="absolute top-[30px] left-0 z-[95] flex w-[280px] flex-col gap-0.5 rounded-lg border border-line2 bg-raised p-1.5 text-tx shadow-[var(--shadow)]">
              {items.map((it, i) =>
                it.separator ? (
                  <span key={i} className="my-1 h-px bg-line" />
                ) : it.heading ? (
                  <span key={i} className="px-2 pt-1 pb-0.5 font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">
                    {it.label}
                  </span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    disabled={it.disabled}
                    onClick={() => {
                      setOpen(null)
                      it.run?.()
                    }}
                    className="flex items-center justify-between rounded-[5px] px-2 py-1.5 text-left hover:bg-hover disabled:text-tx3 disabled:hover:bg-transparent"
                  >
                    {it.label}
                    {it.kbd ? <Kbd>{it.kbd}</Kbd> : null}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}
