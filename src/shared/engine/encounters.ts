import { buildUsageIndex, type Owner } from '../model/usage'
import type { Project } from '../model/project'

// Un incontro vive solo dentro le scene: quando non è più in nessuna scena va eliminato dal progetto.

/** Modifica che può lasciare incontri senza scena: scene eliminate o un incontro tolto da una scena. */
export interface SceneChange {
  deletedSceneIds?: ReadonlySet<string>
  detached?: { sceneId: string; encounterId: string }
}

/** Incontri assegnati ad almeno una scena, dopo la modifica indicata (senza modifica: com'è ora). */
function encountersInScenes(p: Project, change: SceneChange = {}): Set<string> {
  const used = new Set<string>()
  for (const s of p.scenes) {
    if (change.deletedSceneIds?.has(s.id)) continue
    for (const id of s.encounterIds) {
      if (change.detached && change.detached.sceneId === s.id && change.detached.encounterId === id) continue
      used.add(id)
    }
  }
  return used
}

/** Incontri che non stanno in nessuna scena (da file vecchi o modifiche precedenti). */
export function encountersWithoutScene(p: Project): string[] {
  const used = encountersInScenes(p)
  return p.encounters.filter((e) => !used.has(e.id)).map((e) => e.id)
}

/** Incontri che oggi stanno in una scena e dopo la modifica non starebbero più in nessuna: vanno eliminati con lei. */
export function encountersOrphanedBy(p: Project, change: SceneChange): string[] {
  const before = encountersInScenes(p)
  const after = encountersInScenes(p, change)
  return p.encounters.filter((e) => before.has(e.id) && !after.has(e.id)).map((e) => e.id)
}

/**
 * Chi impedisce di eliminare gli incontri: entità che li citano (es. requisiti di quest, condizioni) e che restano nel progetto.
 * `goingAway` sono gli id che spariscono insieme agli incontri (scene eliminate, gli incontri stessi).
 */
export function encounterBlockers(p: Project, encounterIds: readonly string[], goingAway: ReadonlySet<string> = new Set()): Owner[] {
  const usage = buildUsageIndex(p)
  const gone = new Set([...goingAway, ...encounterIds])
  const out: Owner[] = []
  for (const id of encounterIds) {
    for (const o of usage.get(id) ?? []) {
      // La scena che lo contiene non lo "usa": lo perde e basta.
      if (gone.has(o.id) || (o.type === 'scene' && p.scenes.find((s) => s.id === o.id)?.encounterIds.includes(id))) continue
      if (!out.some((x) => x.id === o.id)) out.push(o)
    }
  }
  return out
}
