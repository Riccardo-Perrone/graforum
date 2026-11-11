import type { EntityType } from '../model/ids'
import type { Condition } from '../model/logic'
import type { Project } from '../model/project'
import { describeCondition, entityName } from './describe'
import { encountersWithoutScene } from './encounters'
import { reachableFromStart, transitions } from './graph'
import { existingIds, findRefs, TYPE_NAMES } from './refs'
import { effectSites, leaves, scenesWithDialog, sourcesOf } from './sources'

// Validazione del grafo (§4 dei requisiti, 6e del design).

export type Severity = 'error' | 'warning' | 'note'

/** Codice stabile del problema: le correzioni rapide e i filtri si agganciano a questo, non al titolo mostrato. */
export type IssueCode =
  | 'missingStart'
  | 'unreachable'
  | 'deadEnd'
  | 'warningWithoutEncounter'
  | 'encounterWithoutEnemies'
  | 'encounterWithoutScene'
  | 'groupWithoutEntry'
  | 'groupWithoutExit'
  | 'endingWithoutLabel'
  | 'endingWithoutColor'
  | 'brokenRef'
  | 'impossibleCondition'
  | 'stepWithoutRequirements'
  | 'dialogWithoutStart'
  | 'dialogUnassigned'
  | 'enemyUnused'
  | 'itemWithoutImage'

export interface Issue {
  id: string
  code: IssueCode
  severity: Severity
  title: string
  detail: string
  /** Entità da inquadrare o aprire. */
  target: { type: EntityType; id: string }
  /** Scena da evidenziare nel grafo, se c'è. */
  sceneId: string | null
}

export function validate(p: Project): Issue[] {
  const issues: Issue[] = []
  const add = (code: IssueCode, severity: Severity, title: string, detail: string, type: EntityType, id: string, sceneId: string | null = null) =>
    issues.push({ id: `${code}:${type}:${id}:${issues.length}`, code, severity, title, detail, target: { type, id }, sceneId })

  const ids = existingIds(p)
  const ts = transitions(p)
  const endingScenes = new Set(p.endings.map((e) => e.sceneId))

  // Partenza
  if (!p.startSceneId || !ids.scene.has(p.startSceneId)) add('missingStart', 'error', 'Scena di partenza mancante', 'Indica da quale scena inizia l’avventura.', 'project', p.id)

  // Raggiungibilità e vicoli ciechi
  if (p.startSceneId && ids.scene.has(p.startSceneId)) {
    const reach = reachableFromStart(p, ts)
    for (const s of p.scenes) if (!reach.has(s.id)) add('unreachable', 'warning', 'Scena irraggiungibile', `«${s.title}» non si raggiunge dalla partenza.`, 'scene', s.id, s.id)
  }
  for (const s of p.scenes) {
    if (endingScenes.has(s.id)) continue
    const exits = ts.filter((t) => t.from === s.id)
    if (exits.length === 0) add('deadEnd', 'warning', 'Vicolo cieco', `«${s.title}» non ha uscite e non è un finale.`, 'scene', s.id, s.id)
  }

  // Scene Warning e incontri
  for (const s of p.scenes) {
    if (s.tag === 'warning' && s.encounterIds.length === 0) add('warningWithoutEncounter', 'error', 'Scena Warning senza incontro', `«${s.title}» è Warning ma non ha incontri assegnati.`, 'scene', s.id, s.id)
    for (const encId of s.encounterIds) {
      const enc = p.encounters.find((e) => e.id === encId)
      if (enc && enc.enemies.length === 0) add('encounterWithoutEnemies', 'error', 'Incontro senza enemy', `L’incontro «${enc.name}» non ha enemy.`, 'scene', s.id, s.id)
    }
  }

  for (const encId of encountersWithoutScene(p)) {
    const enc = p.encounters.find((e) => e.id === encId)!
    add('encounterWithoutScene', 'warning', 'Incontro senza scena', `L’incontro «${enc.name}» non è in nessuna scena: non si può giocare.`, 'encounter', enc.id)
  }

  // Gruppi
  for (const g of p.groups) {
    if (g.entrySceneIds.length === 0) add('groupWithoutEntry', 'warning', 'Gruppo senza entrata', `Il gruppo «${g.name}» non ha una scena di entrata.`, 'group', g.id)
    if (g.exitSceneIds.length === 0) add('groupWithoutExit', 'warning', 'Gruppo senza uscita', `Il gruppo «${g.name}» non ha una scena di uscita.`, 'group', g.id)
  }

  // Finali
  for (const e of p.endings) {
    if (!e.label.trim()) add('endingWithoutLabel', 'error', 'Finale senza etichetta', `Il finale in «${entityName(p, 'scene', e.sceneId)}» non ha etichetta.`, 'ending', e.id, e.sceneId)
    if (!e.color) add('endingWithoutColor', 'error', 'Finale senza colore', `Il finale «${e.label}» non ha colore.`, 'ending', e.id, e.sceneId)
  }

  // Riferimenti a entità eliminate
  const owners: [EntityType, string, string | null, unknown][] = [
    ...p.scenes.map((x): [EntityType, string, string | null, unknown] => ['scene', x.id, x.id, x]),
    ...p.links.map((x): [EntityType, string, string | null, unknown] => ['link', x.id, x.fromSceneId, x]),
    ...p.groups.map((x): [EntityType, string, string | null, unknown] => ['group', x.id, null, x]),
    ...p.endings.map((x): [EntityType, string, string | null, unknown] => ['ending', x.id, x.sceneId, x]),
    ...p.encounters.map((x): [EntityType, string, string | null, unknown] => ['encounter', x.id, null, x]),
    ...p.npcs.map((x): [EntityType, string, string | null, unknown] => ['npc', x.id, null, x]),
    ...p.enemies.map((x): [EntityType, string, string | null, unknown] => ['enemy', x.id, null, x]),
    ...p.items.map((x): [EntityType, string, string | null, unknown] => ['item', x.id, null, x]),
    ...p.quests.map((x): [EntityType, string, string | null, unknown] => ['quest', x.id, null, x]),
    ...p.dialogs.map((x): [EntityType, string, string | null, unknown] => ['dialog', x.id, null, x])
  ]
  for (const [type, id, sceneId, entity] of owners) {
    for (const ref of findRefs(entity)) {
      if (!ids[ref.type]?.has(ref.id)) {
        add('brokenRef', 'error', 'Riferimento a entità eliminata', `${entityName(p, type, id)}: ${TYPE_NAMES[ref.type]} «${ref.id}» non esiste più (${ref.path}).`, type, id, sceneId)
      }
    }
  }

  // Condizioni impossibili
  const sites = effectSites(p)
  const checkCondition = (c: Condition | null, type: EntityType, id: string, sceneId: string | null, where: string) => {
    for (const leaf of leaves(c)) {
      if (leaf.type === 'questState' || leaf.type === 'hasItem' || leaf.type === 'flag' || leaf.type === 'dialogCompleted' || leaf.type === 'encounterOutcome') {
        if (sourcesOf(p, leaf, sites).length === 0) {
          add('impossibleCondition', 'warning', 'Condizione impossibile', `${where}: «${describeCondition(p, leaf)}» non è mai soddisfatta (nessuno la produce).`, type, id, sceneId)
        }
      }
    }
  }
  for (const s of p.scenes) {
    checkCondition(s.access.condition, 'scene', s.id, s.id, s.title)
    s.items.forEach((i) => checkCondition(i.gate.condition, 'scene', s.id, s.id, `${s.title} · ${entityName(p, 'item', i.itemId)}`))
    s.npcs.forEach((n) => n.dialogs.forEach((d) => checkCondition(d.gate.condition, 'scene', s.id, s.id, `${s.title} · ${entityName(p, 'dialog', d.dialogId)}`)))
  }
  for (const l of p.links) checkCondition(l.gate.condition, 'link', l.id, l.fromSceneId, entityName(p, 'link', l.id))
  for (const d of p.dialogs) d.lines.forEach((line) => line.choices.forEach((c) => checkCondition(c.gate.condition, 'dialog', d.id, null, `${d.title} · ${entityName(p, 'dialogChoice', c.id)}`)))
  for (const q of p.quests) {
    for (const st of q.steps) {
      if (!st.requirements) add('stepWithoutRequirements', 'note', 'Step senza requisiti', `«${q.title} › ${st.title}» si completa solo con un effetto esplicito.`, 'quest', q.id)
      checkCondition(st.requirements, 'quest', q.id, null, `${q.title} › ${st.title}`)
    }
  }

  // Dialoghi
  for (const d of p.dialogs) {
    if (!d.startLineId) add('dialogWithoutStart', 'error', 'Dialogo senza battuta iniziale', `«${d.title}» non ha una battuta di inizio.`, 'dialog', d.id)
    if (scenesWithDialog(p, d.id).length === 0) add('dialogUnassigned', 'note', 'Dialogo mai assegnato', `«${d.title}» non è usato in nessuna scena.`, 'dialog', d.id)
  }

  // Note
  for (const e of p.enemies) {
    if (!p.encounters.some((enc) => enc.enemies.some((x) => x.enemyId === e.id))) add('enemyUnused', 'note', 'Enemy mai usato', `«${e.name}» non compare in nessun incontro.`, 'enemy', e.id)
  }
  for (const i of p.items) if (!i.imageId) add('itemWithoutImage', 'note', 'Oggetto senza immagine', `«${i.name}» non ha un’immagine.`, 'item', i.id)

  const order: Record<Severity, number> = { error: 0, warning: 1, note: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}

const cache = new WeakMap<Project, Issue[]>()

/**
 * Come `validate`, ma calcolata una sola volta per ogni versione del progetto: il progetto è immutabile
 * (ogni modifica ne crea uno nuovo), quindi barra di stato, toolbar, grafo e schede condividono lo stesso risultato.
 */
export function validateCached(p: Project): Issue[] {
  let issues = cache.get(p)
  if (!issues) {
    issues = validate(p)
    cache.set(p, issues)
  }
  return issues
}
