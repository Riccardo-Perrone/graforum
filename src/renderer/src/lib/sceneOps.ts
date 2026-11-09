import type { Draft } from 'immer'
import { newId, type Owner, type Project, type Scene } from '@shared/model'
import { sceneBlockers } from '../components/logic/UsageList'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { useUiStore } from '../store/ui'
import { apply, emptyGate, getProject } from './entities'

// Operazioni su scene e gruppi condivise da toolbar, menu contestuale e schede.

export function createScene(position: { x: number; y: number }, groupId: string | null = null): string {
  const id = newId('scene')
  const scene: Scene = {
    id,
    title: 'Nuova scena',
    description: '',
    imageId: null,
    tag: 'neutral',
    tagHidden: false,
    labelIds: [],
    cover: null,
    groupId,
    npcs: [],
    items: [],
    encounterIds: [],
    access: emptyGate(),
    entryEffects: [],
    entryCheck: null,
    position: { x: Math.round(position.x), y: Math.round(position.y) }
  }
  apply('Nuova scena', (d) => void d.scenes.push(scene))
  useUiStore.getState().setSelection([id])
  return id
}

/** Elimina la scena con i suoi collegamenti; se è usata altrove restituisce chi la usa e non fa nulla. */
export async function deleteScene(id: string): Promise<Owner[] | null> {
  return (await deleteScenes([id]))?.owners ?? null
}

/** Elimina più scene con una sola conferma; se una è usata altrove non fa nulla e restituisce chi la usa. */
export async function deleteScenes(ids: string[]): Promise<{ name: string; owners: Owner[] } | null> {
  const p = getProject()
  const scenes = p.scenes.filter((s) => ids.includes(s.id))
  if (!scenes.length) return null
  for (const scene of scenes) {
    const owners = sceneBlockers(scene.id)
    if (owners.length) return { name: scene.title, owners }
  }
  const gone = new Set(scenes.map((s) => s.id))
  const links = p.links.filter((l) => gone.has(l.fromSceneId) || gone.has(l.toSceneId)).length
  const ok = await confirmDialog({
    title: scenes.length === 1 ? `Eliminare la scena «${scenes[0]!.title}»?` : `Eliminare ${scenes.length} scene?`,
    detail: links ? `Verranno eliminati anche ${links} collegamenti.` : undefined,
    confirmLabel: scenes.length === 1 ? 'Elimina scena' : 'Elimina scene',
    confirmCommand: 'deleteSelection'
  })
  if (!ok) return null
  const ui = useUiStore.getState()
  if (ui.sheet?.kind === 'scene' && gone.has(ui.sheet.id)) ui.openSheet(null)
  ui.setSelection([])
  apply(scenes.length === 1 ? 'Elimina scena' : 'Elimina scene', (d) => {
    d.scenes = d.scenes.filter((s) => !gone.has(s.id))
    d.links = d.links.filter((l) => !gone.has(l.fromSceneId) && !gone.has(l.toSceneId))
    d.endings = d.endings.filter((e) => !gone.has(e.sceneId))
    for (const g of d.groups) {
      g.entrySceneIds = g.entrySceneIds.filter((x) => !gone.has(x))
      g.exitSceneIds = g.exitSceneIds.filter((x) => !gone.has(x))
    }
  })
  return null
}

/** Elimina collegamenti dopo conferma. */
export async function deleteLinks(ids: string[]): Promise<void> {
  const p = getProject()
  const links = p.links.filter((l) => ids.includes(l.id))
  if (!links.length) return
  const title = (id: string) => p.scenes.find((s) => s.id === id)?.title ?? '?'
  const ok = await confirmDialog({
    title: links.length === 1 ? 'Eliminare il collegamento?' : `Eliminare ${links.length} collegamenti?`,
    detail: links.map((l) => `${title(l.fromSceneId)} ${l.bidirectional ? '↔' : '→'} ${title(l.toSceneId)}${l.label ? ` · ${l.label}` : ''}`).join('\n'),
    confirmLabel: links.length === 1 ? 'Elimina collegamento' : 'Elimina collegamenti',
    confirmCommand: 'deleteSelection'
  })
  if (!ok) return
  const gone = new Set(links.map((l) => l.id))
  apply(links.length === 1 ? 'Elimina collegamento' : 'Elimina collegamenti', (d) => void (d.links = d.links.filter((l) => !gone.has(l.id))))
}

/**
 * Il collegamento tra due scene è unico: A→B, oppure A↔B, oppure A→B insieme a B→A.
 * Vero se si può aggiungere (o, con `ignoreId`, modificare) un collegamento da→a.
 */
export function canLink(p: Pick<Project, 'links'>, from: string, to: string, bidirectional = false, ignoreId?: string): boolean {
  if (from === to) return false
  const between = p.links.filter((l) => l.id !== ignoreId && ((l.fromSceneId === from && l.toSceneId === to) || (l.fromSceneId === to && l.toSceneId === from)))
  if (bidirectional) return between.length === 0
  return !between.some((l) => l.bidirectional || (l.fromSceneId === from && l.toSceneId === to))
}

export function duplicateScene(id: string): void {
  const p = getProject()
  const s = p.scenes.find((x) => x.id === id)
  if (!s) return
  const copy: Scene = structuredClone(s)
  copy.id = newId('scene')
  copy.title = `${s.title} (copia)`
  copy.position = { x: s.position.x + 40, y: s.position.y + 40 }
  copy.items = copy.items.map((i) => ({ ...i, id: newId('sceneItem'), checks: i.checks.map((c) => ({ ...c, id: newId('check') })) }))
  if (copy.entryCheck) copy.entryCheck = { ...copy.entryCheck, id: newId('check') }
  apply('Duplica scena', (d) => void d.scenes.push(copy))
  useUiStore.getState().setSelection([copy.id])
}

/** Nuovo gruppo con le scene selezionate (annidato nel gruppo comune, se c'è). */
export function groupSelection(): string | null {
  const p = getProject()
  const ids = useUiStore.getState().selectedSceneIds
  const scenes = p.scenes.filter((s) => ids.includes(s.id))
  const parents = new Set(scenes.map((s) => s.groupId))
  const parentId = parents.size === 1 ? [...parents][0]! : null
  const id = newId('group')
  apply('Nuovo gruppo', (d) => {
    d.groups.push({ id, name: 'Nuovo gruppo', description: '', parentId, entrySceneIds: scenes[0] ? [scenes[0].id] : [], exitSceneIds: [], color: null, collapsed: false })
    for (const s of d.scenes) if (ids.includes(s.id)) s.groupId = id
  })
  return id
}

/** Scioglie il gruppo: scene e sottogruppi passano al gruppo padre. */
export function ungroup(groupId: string): void {
  apply('Sciogli gruppo', (d) => {
    const g = d.groups.find((x) => x.id === groupId)
    if (!g) return
    for (const s of d.scenes) if (s.groupId === groupId) s.groupId = g.parentId
    for (const c of d.groups) if (c.parentId === groupId) c.parentId = g.parentId
    d.groups = d.groups.filter((x) => x.id !== groupId)
  })
}

/** Toglie le scene dal loro gruppo: passano al gruppo padre (o restano libere). */
export function removeFromGroup(sceneIds: string[]): void {
  const p = getProject()
  if (!p.scenes.some((s) => sceneIds.includes(s.id) && s.groupId)) return
  apply(sceneIds.length > 1 ? 'Rimuovi scene dal gruppo' : 'Rimuovi scena dal gruppo', (d) => {
    for (const s of d.scenes) {
      if (!sceneIds.includes(s.id) || !s.groupId) continue
      const g = d.groups.find((x) => x.id === s.groupId)
      if (g) {
        g.entrySceneIds = g.entrySceneIds.filter((x) => x !== s.id)
        g.exitSceneIds = g.exitSceneIds.filter((x) => x !== s.id)
      }
      s.groupId = g?.parentId ?? null
    }
  })
}

/** Toglie un gruppo dal gruppo che lo contiene (passa al livello superiore). */
export function removeGroupFromParent(groupId: string): void {
  apply('Rimuovi gruppo dal gruppo', (d) => {
    const g = d.groups.find((x) => x.id === groupId)
    const parent = g?.parentId ? d.groups.find((x) => x.id === g.parentId) : undefined
    if (g && parent) g.parentId = parent.parentId
  })
}

/** Aggiunge le scene a un gruppo (e le toglie dal precedente). */
export function addToGroup(sceneIds: string[], groupId: string): void {
  const p = getProject()
  if (!p.groups.some((g) => g.id === groupId) || !p.scenes.some((s) => sceneIds.includes(s.id) && s.groupId !== groupId)) return
  apply(sceneIds.length > 1 ? 'Aggiungi scene al gruppo' : 'Aggiungi scena al gruppo', (d) => assignToGroup(d, sceneIds, groupId))
}

/** Sposta le scene nel gruppo dentro una modifica già aperta (le toglie dal gruppo di prima). */
export function assignToGroup(d: Draft<Project>, sceneIds: string[], groupId: string): void {
  for (const s of d.scenes) {
    if (!sceneIds.includes(s.id) || s.groupId === groupId) continue
    const old = d.groups.find((x) => x.id === s.groupId)
    if (old) {
      old.entrySceneIds = old.entrySceneIds.filter((x) => x !== s.id)
      old.exitSceneIds = old.exitSceneIds.filter((x) => x !== s.id)
    }
    s.groupId = groupId
  }
}

/** Sposta un gruppo intero: tutte le scene dei suoi livelli interni traslano dello stesso scostamento. */
export function moveGroup(groupId: string, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  apply('Sposta gruppo', (d) => {
    const ids = new Set([groupId])
    let added = true
    while (added) {
      added = false
      for (const g of d.groups) if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) (ids.add(g.id), (added = true))
    }
    for (const s of d.scenes) if (s.groupId && ids.has(s.groupId)) s.position = { x: s.position.x + dx, y: s.position.y + dy }
  })
}
