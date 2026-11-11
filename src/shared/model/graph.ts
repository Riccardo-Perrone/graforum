import { z } from 'zod'
import { Id } from './ids'
import { Effect, Gate, Outcome, SkillCheck } from './logic'

// Scene, collegamenti, gruppi, finali, incontri: §4 di docs/modello-dati-v3.md.

export const SceneTag = z.enum(['neutral', 'safe', 'warning'])
export type SceneTag = z.infer<typeof SceneTag>

/** Etichetta personalizzata (nome + colore), definita nel progetto e assegnabile alle scene. */
export const SceneLabel = z.object({ id: Id, name: z.string().min(1), color: z.string() })
export type SceneLabel = z.infer<typeof SceneLabel>

/** Copertina della scena come su Trello: `strip` = fascia sopra la card, `full` = card colorata/illustrata per intero. */
export const SceneCover = z.object({
  imageId: Id.nullable().default(null),
  color: z.string().nullable().default(null),
  size: z.enum(['strip', 'full']).default('strip')
})
export type SceneCover = z.infer<typeof SceneCover>

export const Position = z.object({ x: z.number(), y: z.number() })

/** Un dialogo assegnato a un NPC in una scena: vale il primo il cui gate è soddisfatto. */
export const NpcDialogOption = z.object({ dialogId: Id, gate: Gate.prefault({}) })

export const NpcPresence = z.object({
  npcId: Id,
  gate: Gate.prefault({}),
  dialogs: z.array(NpcDialogOption).default([])
})
export type NpcPresence = z.infer<typeof NpcPresence>

export const SceneItem = z.object({
  id: Id,
  itemId: Id,
  quantity: z.number().int().min(1).default(1),
  gate: Gate.prefault({}),
  /** Prove alternative (es. cassa: FOR 15 o DES 14). */
  checks: z.array(SkillCheck).default([])
})
export type SceneItem = z.infer<typeof SceneItem>

export const Scene = z.object({
  id: Id,
  title: z.string().min(1),
  description: z.string().default(''),
  imageId: Id.nullable().default(null),
  tag: SceneTag.default('neutral'),
  /** Chip del tag nascosto sul nodo del grafo. */
  tagHidden: z.boolean().default(false),
  labelIds: z.array(Id).default([]),
  cover: SceneCover.nullable().default(null),
  groupId: Id.nullable().default(null),
  npcs: z.array(NpcPresence).default([]),
  items: z.array(SceneItem).default([]),
  encounterIds: z.array(Id).default([]),
  access: Gate.prefault({}),
  entryEffects: z.array(Effect).default([]),
  entryCheck: SkillCheck.nullable().default(null),
  position: Position
})
export type Scene = z.infer<typeof Scene>

export const Link = z.object({
  id: Id,
  fromSceneId: Id,
  toSceneId: Id,
  label: z.string().default(''),
  bidirectional: z.boolean().default(false),
  gate: Gate.prefault({}),
  /** Effetti al passaggio (6b del design). */
  effects: z.array(Effect).default([]),
  checks: z.array(SkillCheck).default([])
})
export type Link = z.infer<typeof Link>

export const Group = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().default(''),
  parentId: Id.nullable().default(null),
  entrySceneIds: z.array(Id).default([]),
  exitSceneIds: z.array(Id).default([]),
  color: z.string().nullable().default(null),
  collapsed: z.boolean().default(false)
})
export type Group = z.infer<typeof Group>

/** Tavolozza dei finali (design): i finali nuovi la usano a rotazione, il primo colore è il predefinito. */
export const ENDING_COLORS = ['#6fcf5b', '#44c4d9', '#8ea2ff', '#ad86f5', '#ef7fb8', '#e9c64a'] as const

export const Ending = z.object({
  id: Id,
  sceneId: Id,
  label: z.string().default(''),
  color: z.string().default(ENDING_COLORS[0]),
  /** Collegamenti o scelte segnati a mano come decisivi. */
  manualDecisive: z.array(z.object({ type: z.enum(['link', 'dialogChoice']), id: Id })).default([])
})
export type Ending = z.infer<typeof Ending>

export const Reward = z.object({
  xp: z.number().int().min(0).default(0),
  items: z.array(z.object({ itemId: Id, quantity: z.number().int().min(1).default(1) })).default([])
})
export type Reward = z.infer<typeof Reward>

export const Encounter = z.object({
  id: Id,
  name: z.string().min(1),
  enemies: z.array(z.object({ enemyId: Id, quantity: z.number().int().min(1).default(1) })).default([]),
  nature: z.enum(['unique', 'repeatable']).default('unique'),
  rewards: Reward.prefault({}),
  outcomes: z
    .object({ win: Outcome.prefault({}), flee: Outcome.prefault({}), defeat: Outcome.prefault({}) })
    .prefault({})
})
export type Encounter = z.infer<typeof Encounter>
