import type { Group, Scene } from '../model/graph'

// Gerarchia dei gruppi annidati: discendenti e antenati.

type Groups = readonly Pick<Group, 'id' | 'parentId'>[]

/** Il gruppo e tutti i suoi discendenti, a qualsiasi livello e in qualsiasi ordine dell'elenco. */
export function groupDescendants(groups: Groups, groupId: string): Set<string> {
  const out = new Set([groupId])
  for (let added = true; added; ) {
    added = false
    for (const g of groups) {
      if (g.parentId && out.has(g.parentId) && !out.has(g.id)) {
        out.add(g.id)
        added = true
      }
    }
  }
  return out
}

/** Il gruppo e i suoi antenati, dal più interno al più esterno (si ferma su cicli o gruppi mancanti). */
export function groupAncestors(groups: Groups, groupId: string | null): string[] {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const out: string[] = []
  let g = groupId ? byId.get(groupId) : undefined
  while (g && !out.includes(g.id)) {
    out.push(g.id)
    g = g.parentId ? byId.get(g.parentId) : undefined
  }
  return out
}

/** Vero se `targetId` è il gruppo `groupId` o uno dei suoi antenati. */
export const isGroupOrAncestor = (groups: Groups, targetId: string, groupId: string | null): boolean => groupAncestors(groups, groupId).includes(targetId)

/**
 * Si può spostare il gruppo dentro `targetId`? No dentro se stesso o un suo discendente (ciclo),
 * né nel genitore o in un antenato: salire di livello si fa solo con "Rimuovi dal gruppo", come per le scene.
 */
export const canMoveGroupInto = (groups: Groups, groupId: string, targetId: string): boolean =>
  !groupDescendants(groups, groupId).has(targetId) && !groupAncestors(groups, groupId).includes(targetId)

/** Antenato comune più vicino delle posizioni indicate (gruppi o null = fuori da ogni gruppo). */
export function commonAncestor(groups: Groups, locations: readonly (string | null)[]): string | null {
  if (!locations.length || locations.includes(null)) return null
  const chains = locations.map((id) => groupAncestors(groups, id))
  return chains[0]!.find((id) => chains.every((c) => c.includes(id))) ?? null
}

type GroupsAndScenes = { groups: Groups; scenes: readonly Pick<Scene, 'id' | 'groupId'>[] }

/** Gruppi "selezionati": non vuoti e con tutte le scene (anche dei sottogruppi) nella selezione. */
export function fullySelectedGroups(p: GroupsAndScenes, sceneIds: Iterable<string>): Set<string> {
  const selected = new Set(sceneIds)
  const out = new Set<string>()
  for (const g of p.groups) {
    const inside = groupDescendants(p.groups, g.id)
    const members = p.scenes.filter((s) => s.groupId !== null && inside.has(s.groupId))
    if (members.length && members.every((s) => selected.has(s.id))) out.add(g.id)
  }
  return out
}

/**
 * Gruppi selezionati per intero, contando anche i gruppi scelti direttamente (`groupIds`, es. carte di gruppi collassati):
 * le loro scene valgono come selezionate, quindi anche un gruppo che li contiene può risultare intero.
 */
export function selectedGroups(p: GroupsAndScenes, sceneIds: Iterable<string>, groupIds: readonly string[] = []): Set<string> {
  const chosen = new Set(groupIds.flatMap((id) => [...groupDescendants(p.groups, id)]))
  const scenes = new Set(sceneIds)
  for (const s of p.scenes) if (s.groupId !== null && chosen.has(s.groupId)) scenes.add(s.id)
  const full = fullySelectedGroups(p, scenes)
  for (const id of chosen) full.add(id)
  return full
}

/**
 * Entrate e uscite di un gruppo devono essere scene del gruppo o dei suoi sottogruppi: dopo uno spostamento di scene o gruppi
 * toglie quelle rimaste fuori. Modifica gli oggetti ricevuti (si usa dentro `apply`).
 */
export function pruneGroupEnds(p: { groups: Pick<Group, 'id' | 'parentId' | 'entrySceneIds' | 'exitSceneIds'>[]; scenes: readonly Pick<Scene, 'id' | 'groupId'>[] }): void {
  for (const g of p.groups) {
    const inside = groupDescendants(p.groups, g.id)
    const ok = new Set(p.scenes.filter((s) => s.groupId !== null && inside.has(s.groupId)).map((s) => s.id))
    if (g.entrySceneIds.some((id) => !ok.has(id))) g.entrySceneIds = g.entrySceneIds.filter((id) => ok.has(id))
    if (g.exitSceneIds.some((id) => !ok.has(id))) g.exitSceneIds = g.exitSceneIds.filter((id) => ok.has(id))
  }
}

/** Selezione vista per gruppi: i gruppi interi più esterni e le scene che non stanno dentro uno di essi. */
export function selectionParts(p: GroupsAndScenes, sceneIds: readonly string[], groupIds: readonly string[] = []): { groupIds: string[]; sceneIds: string[] } {
  const full = selectedGroups(p, sceneIds, groupIds)
  const tops = p.groups.filter((g) => full.has(g.id) && !(g.parentId && full.has(g.parentId))).map((g) => g.id)
  const selected = new Set(sceneIds)
  const loose = p.scenes.filter((s) => selected.has(s.id) && !groupAncestors(p.groups, s.groupId).some((id) => full.has(id))).map((s) => s.id)
  return { groupIds: tops, sceneIds: loose }
}

export interface GroupingPlan {
  /** Dove nasce il nuovo gruppo. */
  parentId: string | null
  /** Gruppi che diventano sottogruppi del nuovo gruppo, con tutto il loro contenuto. */
  groupIds: string[]
  /** Scene che entrano direttamente nel nuovo gruppo. */
  sceneIds: string[]
}

/**
 * "Raggruppa la selezione": i gruppi selezionati per intero restano gruppi (diventano sottogruppi del nuovo), le altre scene
 * entrano direttamente. Il nuovo gruppo nasce nell'antenato comune più vicino, così la gerarchia di prima resta dov'è possibile.
 */
export function planGrouping(p: GroupsAndScenes, sceneIds: readonly string[], groupIds: readonly string[] = []): GroupingPlan {
  const parts = selectionParts(p, sceneIds, groupIds)
  const parentOf = new Map(p.groups.map((g) => [g.id, g.parentId]))
  const groupOf = new Map(p.scenes.map((s) => [s.id, s.groupId]))
  const locations = [...parts.groupIds.map((id) => parentOf.get(id) ?? null), ...parts.sceneIds.map((id) => groupOf.get(id) ?? null)]
  return { parentId: commonAncestor(p.groups, locations), ...parts }
}

/**
 * Trascinando scene e gruppi su `targetId`: cosa entra nel gruppo. I gruppi selezionati per intero entrano come sottogruppi
 * (con il loro contenuto); le altre scene entrano direttamente. Si salta ciò che creerebbe un ciclo o farebbe salire di livello.
 */
export function planMoveInto(p: GroupsAndScenes, targetId: string, sceneIds: readonly string[], groupIds: readonly string[] = []): { groupIds: string[]; sceneIds: string[] } {
  const parts = selectionParts(p, sceneIds, groupIds)
  const groupOf = new Map(p.scenes.map((s) => [s.id, s.groupId]))
  return {
    groupIds: parts.groupIds.filter((id) => canMoveGroupInto(p.groups, id, targetId)),
    sceneIds: parts.sceneIds.filter((id) => !isGroupOrAncestor(p.groups, targetId, groupOf.get(id) ?? null))
  }
}
