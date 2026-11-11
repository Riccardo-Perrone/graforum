import type { EntityType } from '../model/ids'
import type { SkillCheck } from '../model/logic'
import type { Project } from '../model/project'

// Riferimenti tra entità: quali campi puntano a cosa, e quali id esistono.

const FIELD_TYPE: Record<string, EntityType> = {
  sceneId: 'scene',
  fromSceneId: 'scene',
  toSceneId: 'scene',
  startSceneId: 'scene',
  entrySceneIds: 'scene',
  exitSceneIds: 'scene',
  itemId: 'item',
  currencyItemId: 'item',
  npcId: 'npc',
  enemyId: 'enemy',
  questId: 'quest',
  stepId: 'step',
  dialogId: 'dialog',
  choiceId: 'dialogChoice',
  encounterId: 'encounter',
  encounterIds: 'encounter',
  flagId: 'flag',
  skillId: 'skill',
  imageId: 'image',
  typeId: 'itemType',
  groupId: 'group',
  parentId: 'group',
  targetLineId: 'dialogLine',
  startLineId: 'dialogLine',
  checkIds: 'check',
  conditionTypeId: 'conditionType',
  fieldId: 'customField',
  labelIds: 'sceneLabel'
}

export interface FoundRef {
  type: EntityType
  id: string
  /** Percorso del campo, utile per i messaggi (es. "gate.condition.itemId"). */
  path: string
}

/** Tutti i riferimenti contenuti in un valore (campi noti e oggetti `{ type, id }`). */
export function findRefs(value: unknown, path = ''): FoundRef[] {
  const out: FoundRef[] = []
  const walk = (v: unknown, p: string, field: string | null) => {
    if (typeof v === 'string') {
      const type = field ? FIELD_TYPE[field] : undefined
      if (type) out.push({ type, id: v, path: p })
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${p}[${i}]`, field))
    } else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o['type'] === 'string' && typeof o['id'] === 'string' && Object.keys(o).length === 2 && o['type'] in TYPE_NAMES) {
        out.push({ type: o['type'] as EntityType, id: o['id'], path: p })
        return
      }
      for (const [k, x] of Object.entries(o)) if (k !== 'id') walk(x, p ? `${p}.${k}` : k, k)
    }
  }
  walk(value, path, null)
  return out
}

export const TYPE_NAMES: Record<EntityType, string> = {
  project: 'progetto',
  scene: 'scena',
  link: 'collegamento',
  group: 'gruppo',
  ending: 'finale',
  npc: 'NPC',
  enemy: 'enemy',
  item: 'oggetto',
  quest: 'quest',
  step: 'step',
  dialog: 'dialogo',
  dialogLine: 'battuta',
  dialogChoice: 'scelta',
  encounter: 'incontro',
  image: 'immagine',
  flag: 'flag',
  check: 'prova',
  sceneItem: 'oggetto in scena',
  document: 'documento',
  preset: 'preset',
  conditionType: 'tipo di condizione',
  skill: 'abilità',
  itemType: 'tipo di oggetto',
  customField: 'campo custom',
  sceneLabel: 'etichetta'
}

/** Tutte le prove di abilità del progetto: collegamenti, oggetti in scena, ingresso delle scene, scelte di dialogo. */
export function allChecks(p: Project): SkillCheck[] {
  return [
    ...p.links.flatMap((l) => l.checks),
    ...p.scenes.flatMap((s) => [...s.items.flatMap((i) => i.checks), ...(s.entryCheck ? [s.entryCheck] : [])]),
    ...p.dialogs.flatMap((d) => d.lines.flatMap((l) => l.choices.flatMap((c) => (c.check ? [c.check] : []))))
  ]
}

/** Insiemi degli id esistenti per tipo. */
export function existingIds(p: Project): Record<EntityType, Set<string>> {
  const checks = allChecks(p)
  return {
    project: new Set([p.id]),
    scene: new Set(p.scenes.map((x) => x.id)),
    link: new Set(p.links.map((x) => x.id)),
    group: new Set(p.groups.map((x) => x.id)),
    ending: new Set(p.endings.map((x) => x.id)),
    npc: new Set(p.npcs.map((x) => x.id)),
    enemy: new Set(p.enemies.map((x) => x.id)),
    item: new Set(p.items.map((x) => x.id)),
    quest: new Set(p.quests.map((x) => x.id)),
    step: new Set(p.quests.flatMap((q) => q.steps.map((s) => s.id))),
    dialog: new Set(p.dialogs.map((x) => x.id)),
    dialogLine: new Set(p.dialogs.flatMap((d) => d.lines.map((l) => l.id))),
    dialogChoice: new Set(p.dialogs.flatMap((d) => d.lines.flatMap((l) => l.choices.map((c) => c.id)))),
    encounter: new Set(p.encounters.map((x) => x.id)),
    image: new Set(p.images.map((x) => x.id)),
    flag: new Set(p.flags.map((x) => x.id)),
    check: new Set(checks.map((c) => c.id)),
    sceneItem: new Set(p.scenes.flatMap((s) => s.items.map((i) => i.id))),
    document: new Set(p.documents.map((x) => x.id)),
    preset: new Set(p.presets.map((x) => x.id)),
    conditionType: new Set(p.settings.conditionTypes.map((x) => x.id)),
    skill: new Set(p.settings.skills.map((x) => x.id)),
    itemType: new Set(p.settings.itemTypes.map((x) => x.id)),
    customField: new Set(p.settings.customFields.map((x) => x.id)),
    sceneLabel: new Set(p.settings.sceneLabels.map((x) => x.id))
  }
}
