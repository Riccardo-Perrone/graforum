import type { EntityType } from '../model/ids'
import type { Effect, Gate, SkillCheck } from '../model/logic'
import type { Project } from '../model/project'
import { describeCheck, describeCondition, describeEffect, entityName } from './describe'
import { distancesFromStart } from './graph'

// Elenco di tutte le condizioni di avanzamento (vista "Avanzamento", 6d).

export type ProgressKind = 'condition' | 'effect' | 'check'

export interface ProgressRow {
  sceneId: string
  kind: ProgressKind
  /** Elemento a cui si riferisce: collegamento, oggetto, scelta di dialogo… */
  element: string
  detail: string
  owner: { type: EntityType; id: string }
  distance: number
}

export function progressRows(p: Project): ProgressRow[] {
  const dist = distancesFromStart(p)
  const rows: ProgressRow[] = []
  const push = (sceneId: string, kind: ProgressKind, element: string, detail: string, owner: { type: EntityType; id: string }) =>
    rows.push({ sceneId, kind, element, detail, owner, distance: dist.get(sceneId) ?? Number.POSITIVE_INFINITY })
  const gate = (sceneId: string, g: Gate, element: string, owner: { type: EntityType; id: string }) => {
    if (g.condition) push(sceneId, 'condition', element, `${describeCondition(p, g.condition)}${g.whenUnmet === 'locked' ? ' · altrimenti bloccato' : ''}`, owner)
  }
  const effects = (sceneId: string, fx: Effect[], element: string, owner: { type: EntityType; id: string }) =>
    fx.forEach((e) => push(sceneId, 'effect', element, describeEffect(p, e), owner))
  const check = (sceneId: string, c: SkillCheck, element: string, owner: { type: EntityType; id: string }) => {
    const s = c.success.target ? ` → ${entityName(p, c.success.target.type, c.success.target.id)}` : ''
    const f = c.failure.target ? `, fallimento → ${entityName(p, c.failure.target.type, c.failure.target.id)}` : ''
    push(sceneId, 'check', element, `${describeCheck(p, c)}${s}${f}`, owner)
  }

  for (const s of p.scenes) {
    const own = { type: 'scene' as const, id: s.id }
    gate(s.id, s.access, 'Accesso alla scena', own)
    effects(s.id, s.entryEffects, 'Ingresso', own)
    if (s.entryCheck) check(s.id, s.entryCheck, 'Prova all’ingresso', own)
    for (const i of s.items) {
      const name = entityName(p, 'item', i.itemId)
      gate(s.id, i.gate, name, own)
      i.checks.forEach((c) => check(s.id, c, name, own))
    }
    for (const n of s.npcs) {
      gate(s.id, n.gate, entityName(p, 'npc', n.npcId), own)
      for (const opt of n.dialogs) {
        gate(s.id, opt.gate, `${entityName(p, 'npc', n.npcId)} · ${entityName(p, 'dialog', opt.dialogId)}`, own)
        const d = p.dialogs.find((x) => x.id === opt.dialogId)
        if (!d) continue
        const downer = { type: 'dialog' as const, id: d.id }
        for (const l of d.lines) {
          effects(s.id, l.effects, `${d.title} · battuta`, downer)
          for (const c of l.choices) {
            const el = `${d.title} · «${c.text.slice(0, 32)}»`
            gate(s.id, c.gate, el, downer)
            effects(s.id, c.effects, el, downer)
            if (c.check) check(s.id, c.check, el, downer)
          }
        }
      }
    }
    for (const encId of s.encounterIds) {
      const e = p.encounters.find((x) => x.id === encId)
      if (!e) continue
      const eo = { type: 'encounter' as const, id: e.id }
      effects(s.id, e.outcomes.win.effects, `${e.name} · vittoria`, eo)
      effects(s.id, e.outcomes.flee.effects, `${e.name} · fuga`, eo)
      effects(s.id, e.outcomes.defeat.effects, `${e.name} · sconfitta`, eo)
    }
  }
  for (const l of p.links) {
    const lo = { type: 'link' as const, id: l.id }
    const el = `${l.label || 'Collegamento'} → ${entityName(p, 'scene', l.toSceneId)}`
    gate(l.fromSceneId, l.gate, el, lo)
    effects(l.fromSceneId, l.effects, el, lo)
    l.checks.forEach((c) => check(l.fromSceneId, c, el, lo))
  }
  return rows.sort((a, b) => a.distance - b.distance)
}
