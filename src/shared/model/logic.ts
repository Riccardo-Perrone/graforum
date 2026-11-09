import { z } from 'zod'
import { Id, Ref } from './ids'

// Condizioni, gate, effetti e skill check: §3 di docs/modello-dati-v3.md.

export const QuestState = z.enum(['notStarted', 'inProgress', 'completed'])
export type QuestState = z.infer<typeof QuestState>

export const EncounterOutcome = z.enum(['win', 'flee', 'defeat'])
export type EncounterOutcome = z.infer<typeof EncounterOutcome>

export const ConditionLeaf = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hasItem'), itemId: Id, quantity: z.number().int().min(1).default(1) }),
  z.object({ type: z.literal('questState'), questId: Id, stepId: Id.nullable().default(null), state: QuestState }),
  z.object({ type: z.literal('dialogCompleted'), dialogId: Id }),
  z.object({ type: z.literal('dialogChoice'), dialogId: Id, choiceId: Id }),
  z.object({ type: z.literal('talkedTo'), npcId: Id }),
  z.object({ type: z.literal('encounterOutcome'), encounterId: Id, outcome: z.union([EncounterOutcome, z.literal('any')]) }),
  z.object({ type: z.literal('flag'), flagId: Id, value: z.boolean() }),
  z.object({ type: z.literal('checkPassed'), checkIds: z.array(Id).min(1) }),
  z.object({ type: z.literal('sceneVisited'), sceneId: Id }),
  z.object({
    type: z.literal('customType'),
    conditionTypeId: Id,
    values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), Ref, z.null()]))
  }),
  z.object({ type: z.literal('freeText'), text: z.string(), ref: Ref.nullable().default(null) })
])
export type ConditionLeaf = z.infer<typeof ConditionLeaf>

export type ConditionGroup = { type: 'group'; op: 'and' | 'or'; children: Condition[] }
export type Condition = ConditionGroup | ConditionLeaf

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('group'), op: z.enum(['and', 'or']), children: z.array(Condition) }),
    ConditionLeaf
  ])
) as z.ZodType<Condition>

/** Visibilità/accesso: cosa succede se la condizione non è soddisfatta (decisione 6). */
export const Gate = z.object({
  condition: Condition.nullable().default(null),
  whenUnmet: z.enum(['hidden', 'locked']).default('hidden'),
  lockedMessage: z.string().default('')
})
export type Gate = z.infer<typeof Gate>

export const Effect = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gainItem'), itemId: Id, quantity: z.number().int().min(1).default(1) }),
  z.object({ type: z.literal('loseItem'), itemId: Id, quantity: z.number().int().min(1).default(1) }),
  z.object({ type: z.literal('questStart'), questId: Id }),
  z.object({ type: z.literal('questAdvance'), questId: Id, stepId: Id.nullable().default(null) }),
  z.object({ type: z.literal('questComplete'), questId: Id, stepId: Id.nullable().default(null) }),
  z.object({ type: z.literal('unlock'), target: Ref }),
  z.object({ type: z.literal('lock'), target: Ref }),
  z.object({ type: z.literal('setFlag'), flagId: Id, value: z.boolean() }),
  z.object({ type: z.literal('freeText'), text: z.string() })
])
export type Effect = z.infer<typeof Effect>

export const Outcome = z.object({
  /** Scena (grafo) o battuta (dialogo); null = nessuno spostamento. */
  target: Ref.nullable().default(null),
  effects: z.array(Effect).default([])
})
export type Outcome = z.infer<typeof Outcome>

export const SkillCheck = z.object({
  id: Id,
  skillId: Id,
  dc: z.number().int().min(1),
  success: Outcome,
  failure: Outcome
})
export type SkillCheck = z.infer<typeof SkillCheck>
