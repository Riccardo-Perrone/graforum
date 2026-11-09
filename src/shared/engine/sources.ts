import type { EntityType } from '../model/ids'
import type { Condition, ConditionLeaf, Effect } from '../model/logic'
import type { Project } from '../model/project'
import { entityName } from './describe'

// Chi produce cosa: effetti nel progetto e fonti che soddisfano un requisito (decisione 4).

export interface Site {
  type: EntityType
  id: string
  label: string
  /** Dove si trova l'effetto nell'entità, es. "ingresso", "scelta «…»", "vittoria". */
  where: string
}

export interface EffectSite extends Site {
  effect: Effect
}

export function effectSites(p: Project): EffectSite[] {
  const out: EffectSite[] = []
  const push = (type: EntityType, id: string, label: string, where: string, effects: Effect[]) =>
    effects.forEach((effect) => out.push({ type, id, label, where, effect }))

  for (const s of p.scenes) {
    push('scene', s.id, s.title, 'ingresso', s.entryEffects)
    if (s.entryCheck) {
      push('scene', s.id, s.title, 'prova all’ingresso riuscita', s.entryCheck.success.effects)
      push('scene', s.id, s.title, 'prova all’ingresso fallita', s.entryCheck.failure.effects)
    }
    for (const i of s.items) {
      push('scene', s.id, s.title, 'oggetto presente', [{ type: 'gainItem', itemId: i.itemId, quantity: i.quantity }])
      for (const c of i.checks) push('scene', s.id, s.title, 'prova sull’oggetto', [...c.success.effects, ...c.failure.effects])
    }
  }
  for (const l of p.links) {
    const label = entityName(p, 'link', l.id)
    push('link', l.id, label, 'passaggio', l.effects)
    for (const c of l.checks) {
      push('link', l.id, label, 'prova riuscita', c.success.effects)
      push('link', l.id, label, 'prova fallita', c.failure.effects)
    }
  }
  for (const d of p.dialogs) {
    for (const line of d.lines) {
      push('dialog', d.id, d.title, `battuta «${line.text.slice(0, 30)}»`, line.effects)
      for (const c of line.choices) {
        const where = `scelta «${c.text.slice(0, 30)}»`
        push('dialog', d.id, d.title, where, c.effects)
        if (c.check) {
          push('dialog', d.id, d.title, `${where} riuscita`, c.check.success.effects)
          push('dialog', d.id, d.title, `${where} fallita`, c.check.failure.effects)
        }
      }
    }
  }
  for (const e of p.encounters) {
    push('encounter', e.id, e.name, 'vittoria', e.outcomes.win.effects)
    push('encounter', e.id, e.name, 'fuga', e.outcomes.flee.effects)
    push('encounter', e.id, e.name, 'sconfitta', e.outcomes.defeat.effects)
    push('encounter', e.id, e.name, 'ricompensa', e.rewards.items.map((r) => ({ type: 'gainItem' as const, itemId: r.itemId, quantity: r.quantity })))
  }
  for (const q of p.quests) {
    push('quest', q.id, q.title, 'ricompensa', q.rewards.items.map((r) => ({ type: 'gainItem' as const, itemId: r.itemId, quantity: r.quantity })))
  }
  for (const n of p.npcs) {
    push('npc', n.id, n.name, 'negozio', n.services.shop.map((s) => ({ type: 'gainItem' as const, itemId: s.itemId, quantity: 1 })))
    push('npc', n.id, n.name, 'bottino', n.loot.items.map((r) => ({ type: 'gainItem' as const, itemId: r.itemId, quantity: r.quantity })))
  }
  for (const n of p.enemies) {
    push('enemy', n.id, n.name, 'bottino', n.loot.items.map((r) => ({ type: 'gainItem' as const, itemId: r.itemId, quantity: r.quantity })))
  }
  return out
}

export function leaves(c: Condition | null): ConditionLeaf[] {
  if (!c) return []
  return c.type === 'group' ? c.children.flatMap(leaves) : [c]
}

/** Fonti che possono rendere vera una condizione semplice. Vuoto = nessuno la soddisfa. */
export function sourcesOf(p: Project, leaf: ConditionLeaf, sites = effectSites(p)): Site[] {
  const site = (type: EntityType, id: string, where: string): Site => ({ type, id, label: entityName(p, type, id), where })
  const scenesWithDialog = (dialogId: string) =>
    p.scenes.filter((s) => s.npcs.some((n) => n.dialogs.some((d) => d.dialogId === dialogId)))
  switch (leaf.type) {
    case 'hasItem':
      return sites.filter((s) => s.effect.type === 'gainItem' && s.effect.itemId === leaf.itemId)
    case 'questState':
      if (leaf.state === 'notStarted') return [site('quest', leaf.questId, 'stato iniziale')]
      return [
        ...sites.filter((s) => 'questId' in s.effect && s.effect.questId === leaf.questId && (!leaf.stepId || !('stepId' in s.effect) || s.effect.stepId === null || s.effect.stepId === leaf.stepId)),
        ...p.quests
          .filter((q) => q.id === leaf.questId)
          .flatMap((q) => q.steps.filter((st) => st.requirements && (!leaf.stepId || st.id === leaf.stepId)).map((st) => site('quest', q.id, `requisiti dello step «${st.title}»`)))
      ]
    case 'dialogCompleted':
      return scenesWithDialog(leaf.dialogId).map((s) => ({ ...site('dialog', leaf.dialogId, `in ${s.title}`) }))
    case 'dialogChoice':
      return scenesWithDialog(leaf.dialogId).length ? [site('dialog', leaf.dialogId, `scelta ${entityName(p, 'dialogChoice', leaf.choiceId)}`)] : []
    case 'talkedTo':
      return p.scenes.filter((s) => s.npcs.some((n) => n.npcId === leaf.npcId && n.dialogs.length)).map((s) => site('scene', s.id, 'dialogo con l’NPC'))
    case 'encounterOutcome':
      return p.scenes.filter((s) => s.encounterIds.includes(leaf.encounterId)).map((s) => site('encounter', leaf.encounterId, `in ${s.title}`))
    case 'flag': {
      const f = p.flags.find((x) => x.id === leaf.flagId)
      return [
        ...(f && f.defaultValue === leaf.value ? [site('flag', f.id, 'valore iniziale')] : []),
        ...sites.filter((s) => s.effect.type === 'setFlag' && s.effect.flagId === leaf.flagId && s.effect.value === leaf.value)
      ]
    }
    case 'checkPassed':
    case 'sceneVisited':
    case 'customType':
    case 'freeText':
      // Sempre soddisfacibili in linea di principio: non generano avvisi.
      return [site('project', p.id, 'verifica manuale')]
  }
}

/** Per un'entità (dialogo, incontro, scena…), gli step di quest che contribuisce a completare. */
export function stepsSatisfiedBy(p: Project, type: EntityType, id: string): { questId: string; stepId: string; label: string }[] {
  const sites = effectSites(p)
  const out: { questId: string; stepId: string; label: string }[] = []
  for (const q of p.quests) {
    for (const st of q.steps) {
      const hit = leaves(st.requirements).some((leaf) =>
        sourcesOf(p, leaf, sites).some((s) => s.id === id && s.type === type) ||
        (type === 'scene' && leaf.type === 'sceneVisited' && leaf.sceneId === id) ||
        (type === 'scene' && (leaf.type === 'dialogCompleted' || leaf.type === 'encounterOutcome') &&
          sourcesOf(p, leaf, sites).some((s) => s.where === `in ${entityName(p, 'scene', id)}`))
      )
      if (hit) out.push({ questId: q.id, stepId: st.id, label: `${q.title} › ${st.title}` })
    }
  }
  return out
}
