import type { EntityType } from '../model/ids'
import type { Condition, Effect, QuestState, SkillCheck } from '../model/logic'
import type { Project } from '../model/project'

// Nomi leggibili delle entità e frasi "in parole" per condizioni ed effetti.

export function entityName(p: Project, type: EntityType, id: string | null | undefined): string {
  if (!id) return '—'
  const find = <T extends { id: string }>(list: T[]) => list.find((x) => x.id === id)
  switch (type) {
    case 'scene':
      return find(p.scenes)?.title ?? '(scena eliminata)'
    case 'link': {
      const l = find(p.links)
      return l ? l.label || `${entityName(p, 'scene', l.fromSceneId)} → ${entityName(p, 'scene', l.toSceneId)}` : '(collegamento eliminato)'
    }
    case 'group':
      return find(p.groups)?.name ?? '(gruppo eliminato)'
    case 'ending':
      return find(p.endings)?.label ?? '(finale eliminato)'
    case 'npc':
      return find(p.npcs)?.name ?? '(NPC eliminato)'
    case 'enemy':
      return find(p.enemies)?.name ?? '(enemy eliminato)'
    case 'item':
      return find(p.items)?.name ?? '(oggetto eliminato)'
    case 'quest':
      return find(p.quests)?.title ?? '(quest eliminata)'
    case 'step':
      return p.quests.flatMap((q) => q.steps).find((s) => s.id === id)?.title ?? '(step eliminato)'
    case 'dialog':
      return find(p.dialogs)?.title ?? '(dialogo eliminato)'
    case 'dialogLine': {
      const line = p.dialogs.flatMap((d) => d.lines).find((l) => l.id === id)
      return line ? `«${truncate(line.text, 40)}»` : '(battuta eliminata)'
    }
    case 'dialogChoice': {
      const c = p.dialogs.flatMap((d) => d.lines.flatMap((l) => l.choices)).find((x) => x.id === id)
      return c ? `«${truncate(c.text, 40)}»` : '(scelta eliminata)'
    }
    case 'encounter':
      return find(p.encounters)?.name ?? '(incontro eliminato)'
    case 'image':
      return find(p.images)?.title || find(p.images)?.fileName || '(immagine eliminata)'
    case 'flag':
      return find(p.flags)?.name ?? '(flag eliminato)'
    case 'document':
      return find(p.documents)?.title ?? '(documento eliminato)'
    case 'preset':
      return find(p.presets)?.name ?? '(preset eliminato)'
    case 'skill':
      return find(p.settings.skills)?.name ?? '(abilità eliminata)'
    case 'itemType':
      return find(p.settings.itemTypes)?.name ?? '—'
    case 'conditionType':
      return find(p.settings.conditionTypes)?.name ?? '(tipo eliminato)'
    case 'customField':
      return find(p.settings.customFields)?.name ?? '—'
    default:
      return id
  }
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export const QUEST_STATE_LABEL: Record<QuestState, string> = {
  notStarted: 'non iniziata',
  inProgress: 'in corso',
  completed: 'completata'
}

const OUTCOME_LABEL = { win: 'vinto', flee: 'concluso con la fuga', defeat: 'perso', any: 'affrontato' } as const

export function describeCheck(p: Project, c: SkillCheck): string {
  return `${entityName(p, 'skill', c.skillId)} CD ${c.dc}`
}

export function describeCondition(p: Project, c: Condition | null): string {
  if (!c) return 'sempre'
  switch (c.type) {
    case 'group': {
      if (c.children.length === 0) return 'sempre'
      const parts = c.children.map((x) => (x.type === 'group' && x.children.length > 1 ? `(${describeCondition(p, x)})` : describeCondition(p, x)))
      return parts.join(c.op === 'and' ? ' e ' : ' oppure ')
    }
    case 'hasItem':
      return `possiede ${c.quantity > 1 ? `${c.quantity} × ` : ''}${entityName(p, 'item', c.itemId)}`
    case 'questState':
      return `${c.stepId ? `lo step «${entityName(p, 'step', c.stepId)}» di ` : 'la quest '}${entityName(p, 'quest', c.questId)} è ${QUEST_STATE_LABEL[c.state]}`
    case 'dialogCompleted':
      return `ha completato il dialogo ${entityName(p, 'dialog', c.dialogId)}`
    case 'dialogChoice':
      return `ha scelto ${entityName(p, 'dialogChoice', c.choiceId)} in ${entityName(p, 'dialog', c.dialogId)}`
    case 'talkedTo':
      return `ha parlato con ${entityName(p, 'npc', c.npcId)}`
    case 'encounterOutcome':
      return `l'incontro ${entityName(p, 'encounter', c.encounterId)} è ${OUTCOME_LABEL[c.outcome]}`
    case 'flag':
      return `${entityName(p, 'flag', c.flagId)} = ${c.value ? 'vero' : 'falso'}`
    case 'checkPassed':
      return `ha superato ${c.checkIds.length > 1 ? 'una prova tra ' : 'la prova '}${c.checkIds.map((id) => checkName(p, id)).join(' / ')}`
    case 'sceneVisited':
      return `ha visitato ${entityName(p, 'scene', c.sceneId)}`
    case 'customType': {
      const t = p.settings.conditionTypes.find((x) => x.id === c.conditionTypeId)
      const values = Object.entries(c.values)
        .map(([k, v]) => `${t?.params.find((x) => x.key === k)?.label ?? k}: ${v && typeof v === 'object' ? entityName(p, v.type, v.id) : String(v)}`)
        .join(', ')
      return `${t?.name ?? 'condizione custom'}${values ? ` (${values})` : ''}`
    }
    case 'freeText':
      return c.text || 'condizione personalizzata'
  }
}

export function checkName(p: Project, checkId: string): string {
  const all = [
    ...p.links.flatMap((l) => l.checks),
    ...p.scenes.flatMap((s) => [...s.items.flatMap((i) => i.checks), ...(s.entryCheck ? [s.entryCheck] : [])]),
    ...p.dialogs.flatMap((d) => d.lines.flatMap((l) => l.choices.flatMap((c) => (c.check ? [c.check] : []))))
  ]
  const c = all.find((x) => x.id === checkId)
  return c ? describeCheck(p, c) : '(prova eliminata)'
}

export function describeEffect(p: Project, e: Effect): string {
  switch (e.type) {
    case 'gainItem':
      return `ottiene ${e.quantity > 1 ? `${e.quantity} × ` : ''}${entityName(p, 'item', e.itemId)}`
    case 'loseItem':
      return `perde ${e.quantity > 1 ? `${e.quantity} × ` : ''}${entityName(p, 'item', e.itemId)}`
    case 'questStart':
      return `avvia la quest ${entityName(p, 'quest', e.questId)}`
    case 'questAdvance':
      return `avanza ${entityName(p, 'quest', e.questId)}${e.stepId ? ` → ${entityName(p, 'step', e.stepId)}` : ''}`
    case 'questComplete':
      return `completa ${e.stepId ? `lo step ${entityName(p, 'step', e.stepId)} di ` : ''}${entityName(p, 'quest', e.questId)}`
    case 'unlock':
      return `sblocca ${entityName(p, e.target.type, e.target.id)}`
    case 'lock':
      return `blocca ${entityName(p, e.target.type, e.target.id)}`
    case 'setFlag':
      return `imposta ${entityName(p, 'flag', e.flagId)} = ${e.value ? 'vero' : 'falso'}`
    case 'freeText':
      return e.text || 'effetto personalizzato'
  }
}
