import type { Draft } from 'immer'
import { makeGroup, makeScene, newId, type Group, type Owner, type Project, type Scene } from '@shared/model'
import { encounterBlockers, encountersOrphanedBy, entityName, groupDescendants, planGrouping, pruneGroupEnds } from '@shared/engine'
import { sceneBlockers } from '../components/logic/UsageList'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { useUiStore } from '../store/ui'
import { apply, getProject } from './entities'

// Operazioni su scene e gruppi condivise da toolbar, menu contestuale e schede.

/** Nuova scena con l'angolo in alto a sinistra in `position`; diventa la selezione. */
export function createScene(position: { x: number; y: number }, groupId: string | null = null): string {
  const scene = makeScene(position, { groupId })
  apply('Nuova scena', (d) => void d.scenes.push(scene))
  useUiStore.getState().setSelection([scene.id])
  return scene.id
}

/** Toglie le scene dalle entrate e dalle uscite del gruppo. */
function dropFromGroupEnds(g: Group, sceneIds: ReadonlySet<string>): void {
  g.entrySceneIds = g.entrySceneIds.filter((x) => !sceneIds.has(x))
  g.exitSceneIds = g.exitSceneIds.filter((x) => !sceneIds.has(x))
}

/** Elimina la scena con i suoi collegamenti; se è usata altrove restituisce chi la usa e non fa nulla. */
export async function deleteScene(id: string): Promise<Owner[] | null> {
  return (await deleteScenes([id]))?.owners ?? null
}

/** Chi impedisce di eliminare gli incontri che resterebbero senza scena, come elenco "Usato in" da mostrare. */
function blockedEncounters(p: Project, orphans: string[], goingAway: ReadonlySet<string>): { name: string; owners: Owner[] } | null {
  const owners = encounterBlockers(p, orphans, goingAway)
  if (!owners.length) return null
  return { name: encounterList(p, orphans), owners }
}

const encounterList = (p: Project, ids: string[]) => ids.map((id) => entityName(p, 'encounter', id)).join(', ')

/**
 * Elimina più scene con una sola conferma, insieme ai loro collegamenti e agli incontri che non stanno in altre scene.
 * Se qualcosa che resta nel progetto usa una di queste scene o di questi incontri non fa nulla e restituisce chi la usa.
 */
export async function deleteScenes(ids: string[]): Promise<{ name: string; owners: Owner[] } | null> {
  const p = getProject()
  const scenes = p.scenes.filter((s) => ids.includes(s.id))
  if (!scenes.length) return null
  const gone = new Set(scenes.map((s) => s.id))
  const links = p.links.filter((l) => gone.has(l.fromSceneId) || gone.has(l.toSceneId))
  const orphans = encountersOrphanedBy(p, { deletedSceneIds: gone })
  // Ciò che sparisce insieme alle scene non le blocca (es. due scene eliminate insieme che si citano, o un loro incontro).
  const goingAway = new Set([...gone, ...links.map((l) => l.id), ...orphans])
  for (const scene of scenes) {
    const owners = sceneBlockers(scene.id).filter((o) => !goingAway.has(o.id))
    if (owners.length) return { name: scene.title, owners }
  }
  const blocked = blockedEncounters(p, orphans, goingAway)
  if (blocked) return blocked
  const detail = [
    links.length ? `Verranno eliminati anche ${links.length} collegamenti.` : '',
    orphans.length ? `${orphans.length === 1 ? 'Verrà eliminato anche l’incontro' : 'Verranno eliminati anche gli incontri'} ${encounterList(p, orphans)}.` : ''
  ].filter(Boolean)
  const ok = await confirmDialog({
    title: scenes.length === 1 ? `Eliminare la scena «${scenes[0]!.title}»?` : `Eliminare ${scenes.length} scene?`,
    detail: detail.length ? detail.join('\n') : undefined,
    confirmLabel: scenes.length === 1 ? 'Elimina scena' : 'Elimina scene',
    confirmCommand: 'deleteSelection'
  })
  if (!ok) return null
  const ui = useUiStore.getState()
  if (ui.sheet?.kind === 'scene' && gone.has(ui.sheet.id)) ui.openSheet(null)
  ui.setSelection([])
  const dropEncounters = new Set(orphans)
  apply(scenes.length === 1 ? 'Elimina scena' : 'Elimina scene', (d) => {
    d.scenes = d.scenes.filter((s) => !gone.has(s.id))
    d.links = d.links.filter((l) => !gone.has(l.fromSceneId) && !gone.has(l.toSceneId))
    d.endings = d.endings.filter((e) => !gone.has(e.sceneId))
    d.encounters = d.encounters.filter((e) => !dropEncounters.has(e.id))
    for (const g of d.groups) dropFromGroupEnds(g, gone)
  })
  return null
}

/** Toglie un incontro dalla scena; se non è in altre scene lo elimina dal progetto (dopo conferma, o bloccato se usato altrove). */
export async function detachEncounter(sceneId: string, encounterId: string): Promise<void> {
  const p = getProject()
  const orphans = encountersOrphanedBy(p, { detached: { sceneId, encounterId } })
  if (orphans.length) {
    const blocked = blockedEncounters(p, orphans, new Set([sceneId]))
    if (blocked) return useUiStore.getState().showBlocked(blocked)
    const ok = await confirmDialog({
      title: `Togliere l’incontro «${entityName(p, 'encounter', encounterId)}»?`,
      detail: 'Non è in nessun’altra scena: verrà eliminato dal progetto.',
      confirmLabel: 'Elimina incontro'
    })
    if (!ok) return
  }
  apply(orphans.length ? 'Elimina incontro' : 'Rimuovi incontro', (d) => {
    const s = d.scenes.find((x) => x.id === sceneId)
    if (s) s.encounterIds = s.encounterIds.filter((x) => x !== encounterId)
    if (orphans.length) d.encounters = d.encounters.filter((e) => e.id !== encounterId)
  })
}

/** Elimina incontri che non stanno in nessuna scena (correzione rapida della validazione). */
export async function deleteEncounters(ids: string[]): Promise<void> {
  const p = getProject()
  const blocked = blockedEncounters(p, ids, new Set())
  if (blocked) return useUiStore.getState().showBlocked(blocked)
  const ok = await confirmDialog({
    title: ids.length === 1 ? `Eliminare l’incontro «${entityName(p, 'encounter', ids[0]!)}»?` : `Eliminare ${ids.length} incontri?`,
    detail: ids.length > 1 ? encounterList(p, ids) : undefined,
    confirmLabel: ids.length === 1 ? 'Elimina incontro' : 'Elimina incontri'
  })
  if (!ok) return
  const gone = new Set(ids)
  apply(ids.length === 1 ? 'Elimina incontro' : 'Elimina incontri', (d) => {
    d.encounters = d.encounters.filter((e) => !gone.has(e.id))
    for (const s of d.scenes) s.encounterIds = s.encounterIds.filter((x) => !gone.has(x))
  })
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

/**
 * "Raggruppa la selezione": i gruppi selezionati per intero (tutte le loro scene, o la carta se collassati) restano gruppi e
 * diventano sottogruppi del nuovo; le altre scene entrano direttamente. Il nuovo gruppo nasce nell'antenato comune più vicino.
 */
export function groupSelection(): string | null {
  const p = getProject()
  const { selectedSceneIds, selectedCardIds } = useUiStore.getState()
  const plan = planGrouping(p, selectedSceneIds, selectedCardIds)
  if (!plan.groupIds.length && !plan.sceneIds.length) return null
  const group = makeGroup('Nuovo gruppo', plan.parentId)
  // Entrata: la prima scena (in ordine di progetto) tra quelle sciolte e quelle dei gruppi interi.
  const inside = new Set(plan.groupIds.flatMap((id) => [...groupDescendants(p.groups, id)]))
  const entry = p.scenes.find((s) => plan.sceneIds.includes(s.id) || (s.groupId !== null && inside.has(s.groupId)))
  group.entrySceneIds = entry ? [entry.id] : []
  apply('Nuovo gruppo', (d) => {
    d.groups.push(group)
    moveIntoGroup(d, group.id, plan)
  })
  return group.id
}

/** Selezione da raggruppare: scene o carte di gruppi collassati. */
export const canGroupSelection = (): boolean => {
  const ui = useUiStore.getState()
  return ui.selectedSceneIds.length > 0 || ui.selectedCardIds.length > 0
}

/**
 * Dentro una modifica già aperta: i gruppi diventano sottogruppi di `targetId` (con tutto il loro contenuto), le scene
 * entrano direttamente; poi entrate e uscite rimaste fuori dai loro gruppi si tolgono.
 */
export function moveIntoGroup(d: Draft<Project>, targetId: string, plan: { groupIds: readonly string[]; sceneIds: readonly string[] }): void {
  for (const g of d.groups) if (plan.groupIds.includes(g.id)) g.parentId = targetId
  assignToGroup(d, [...plan.sceneIds], targetId)
  pruneGroupEnds(d)
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
      if (g) dropFromGroupEnds(g, new Set([s.id]))
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
    if (old) dropFromGroupEnds(old, new Set([s.id]))
    s.groupId = groupId
  }
}
