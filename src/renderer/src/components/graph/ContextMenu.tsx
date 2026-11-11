import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppWindow, Copy, FolderInput, FolderMinus, FolderOutput, ListTree, PanelTop, Play, Plus, SquareDashed, Trash2, Waypoints } from 'lucide-react'
import { apply, useProject } from '../../lib/entities'
import { useKbd } from '../../lib/commands'
import { useCloseKey } from '../../lib/shortcuts'
import { playFromScene } from '../../lib/playtest'
import { createScene, deleteScenes, duplicateScene, groupSelection, removeFromGroup, removeGroupFromParent, ungroup } from '../../lib/sceneOps'
import { openEntity, useUiStore } from '../../store/ui'
import { Kbd } from '../ui/primitives'
import { sceneTopLeft } from './buildGraph'

/** Intestazione del menu della selezione: scene e gruppi collassati. */
const selectionLabel = (scenes: number, cards: number) =>
  [scenes ? `${scenes} SCENE` : '', cards ? `${cards} ${cards === 1 ? 'GRUPPO' : 'GRUPPI'}` : ''].filter(Boolean).join(' + ') + (scenes + cards === 1 ? ' SELEZIONATA' : ' SELEZIONATE')

export interface MenuState {
  x: number
  y: number
  kind: 'scene' | 'selection' | 'group' | 'pane'
  id: string
  flowPos?: { x: number; y: number }
}

function Item({ icon, children, kbd, onClick, danger }: { icon: ReactNode; children: ReactNode; kbd?: string; onClick(): void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2.5 rounded-[5px] px-2 py-1.5 text-left hover:bg-hover ${danger ? 'text-err' : ''}`}>
      <span className="text-tx3">{icon}</span>
      <span className="flex-1">{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  )
}

/** Menu contestuale del grafo: scena, gruppo, area vuota. */
export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose(): void }) {
  const p = useProject()
  const ui = useUiStore()
  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }
  const group = p.groups.find((g) => g.id === menu.id)
  const scene = p.scenes.find((s) => s.id === menu.id)
  const kbdGroup = useKbd('groupSelection')
  const kbdNew = useKbd('newScene')
  const kbdHere = useKbd('playFromHere')
  const kbdDelete = useKbd('deleteSelection')
  useCloseKey(onClose)
  // Il menu agisce su tutta la selezione se la scena cliccata ne fa parte.
  const targets = menu.kind === 'selection' || (scene && ui.selectedSceneIds.includes(scene.id)) ? ui.selectedSceneIds : scene ? [scene.id] : []
  const inGroup = p.scenes.some((s) => targets.includes(s.id) && s.groupId)
  const many = targets.length > 1
  const removeItem = inGroup && (
    <Item icon={<FolderOutput size={13} />} onClick={run(() => removeFromGroup(targets))}>
      {many ? 'Rimuovi la selezione dal gruppo' : 'Rimuovi dal gruppo'}
    </Item>
  )

  return createPortal(
    <div className="fixed inset-0 z-[90]" onMouseDown={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())}>
      <div
        className="absolute flex w-[260px] flex-col gap-0.5 rounded-lg border border-line2 bg-raised p-1.5 text-[12.5px] shadow-[var(--shadow)]"
        style={{ left: Math.min(menu.x, window.innerWidth - 270), top: Math.min(menu.y, window.innerHeight - 320) }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {menu.kind === 'scene' && scene && (
          <>
            <span className="px-2 py-1 font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">{scene.title.toUpperCase()}</span>
            <Item icon={<PanelTop size={13} />} onClick={run(() => openEntity('scene', scene.id))}>
              Apri scheda
            </Item>
            <Item icon={<AppWindow size={13} />} onClick={run(() => ui.openSheet({ kind: 'scene', id: scene.id }))}>
              Apri in finestra al centro
            </Item>
            <Item icon={<Play size={13} />} kbd={kbdHere} onClick={run(() => playFromScene(scene.id))}>
              Parti da qui
            </Item>
            <Item icon={<ListTree size={13} />} onClick={run(() => ui.openSheet({ kind: 'cross', tab: 'progress', scopeSceneId: scene.id }))}>
              Mostra avanzamento
            </Item>
            <Item icon={<Waypoints size={13} />} onClick={run(() => apply('Scena di partenza', (d) => void (d.startSceneId = scene.id)))}>
              Imposta come partenza
            </Item>
            <Item icon={<Copy size={13} />} onClick={run(() => duplicateScene(scene.id))}>
              Duplica
            </Item>
            {(ui.selectedSceneIds.length > 0 || ui.selectedCardIds.length > 0) && (
              <Item icon={<SquareDashed size={13} />} kbd={kbdGroup} onClick={run(() => groupSelection())}>
                Raggruppa la selezione
              </Item>
            )}
            {removeItem}
            <Item
              icon={<Trash2 size={13} />}
              danger
              kbd={kbdDelete}
              onClick={run(async () => {
                // Come gli altri comandi del menu: agisce su tutta la selezione se la scena ne fa parte.
                const blocked = await deleteScenes(targets)
                if (blocked) ui.showBlocked(blocked)
              })}
            >
              {many ? `Elimina ${targets.length} scene` : 'Elimina'}
            </Item>
          </>
        )}
        {menu.kind === 'selection' && (
          <>
            <span className="px-2 py-1 font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">{selectionLabel(ui.selectedSceneIds.length, ui.selectedCardIds.length)}</span>
            <Item icon={<SquareDashed size={13} />} kbd={kbdGroup} onClick={run(() => groupSelection())}>
              Raggruppa la selezione
            </Item>
            {removeItem}
          </>
        )}
        {menu.kind === 'group' && group && (
          <>
            <span className="px-2 py-1 font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">GRUPPO · {group.name.toUpperCase()}</span>
            <Item icon={<PanelTop size={13} />} onClick={run(() => openEntity('group', group.id))}>
              Apri gruppo
            </Item>
            <Item icon={<AppWindow size={13} />} onClick={run(() => ui.openSheet({ kind: 'group', id: group.id }))}>
              Apri in finestra al centro
            </Item>
            <Item icon={<FolderInput size={13} />} onClick={run(() => apply(group.collapsed ? 'Espandi gruppo' : 'Collassa gruppo', (d) => void (d.groups.find((g) => g.id === group.id)!.collapsed = !group.collapsed)))}>
              {group.collapsed ? 'Espandi' : 'Collassa'}
            </Item>
            {group.parentId && (
              <Item icon={<FolderOutput size={13} />} onClick={run(() => removeGroupFromParent(group.id))}>
                Rimuovi dal gruppo
              </Item>
            )}
            <Item icon={<FolderMinus size={13} />} onClick={run(() => ungroup(group.id))}>
              Sciogli gruppo
            </Item>
          </>
        )}
        {menu.kind === 'pane' && (
          <>
            <Item icon={<Plus size={13} />} kbd={kbdNew} onClick={run(() => createScene(sceneTopLeft(menu.flowPos ?? { x: 0, y: 0 })))}>
              Nuova scena qui
            </Item>
            {(ui.selectedSceneIds.length > 0 || ui.selectedCardIds.length > 0) && (
              <Item icon={<SquareDashed size={13} />} kbd={kbdGroup} onClick={run(() => groupSelection())}>
                Raggruppa la selezione
              </Item>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
