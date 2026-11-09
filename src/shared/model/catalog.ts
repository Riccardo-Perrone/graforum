import { z } from 'zod'
import { Id } from './ids'
import { Condition, Effect, Gate, SkillCheck } from './logic'
import { Position, Reward } from './graph'

// Cataloghi NPC, enemy, oggetti, quest e dialoghi: §5 di docs/modello-dati-v3.md.

export const CustomFieldValue = z.object({
  fieldId: Id,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()])
})

const Named = z.object({ name: z.string(), text: z.string().default('') })
const Bonus = z.object({ name: z.string(), bonus: z.number().int() })

export const Attack = z.object({
  name: z.string(),
  bonus: z.number().int().default(0),
  damage: z.string().default(''),
  damageType: z.string().default(''),
  reach: z.string().default('')
})

export const Abilities = z.object({
  str: z.number().int().default(10),
  dex: z.number().int().default(10),
  con: z.number().int().default(10),
  int: z.number().int().default(10),
  wis: z.number().int().default(10),
  cha: z.number().int().default(10)
})

/** Modello standard condiviso da NPC ed enemy. */
const Creature = z.object({
  id: Id,
  name: z.string().min(1),
  imageId: Id.nullable().default(null),
  description: z.string().default(''),
  appearance: z.string().default(''),
  personality: z.string().default(''),
  race: z.string().default(''),
  gender: z.string().default(''),
  age: z.string().default(''),
  alignment: z.string().default(''),
  faction: z.string().default(''),
  role: z.string().default(''),
  tags: z.array(z.string()).default([]),
  background: z.string().default(''),
  secrets: z.string().default(''),
  level: z.string().default(''),
  hp: z.number().int().nullable().default(null),
  ac: z.number().int().nullable().default(null),
  speed: z.string().default(''),
  size: z.string().default(''),
  abilities: Abilities.prefault({}),
  skills: z.array(Bonus).default([]),
  savingThrows: z.array(Bonus).default([]),
  attacks: z.array(Attack).default([]),
  resistances: z.array(z.string()).default([]),
  immunities: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  spells: z.array(Named).default([]),
  traits: z.array(Named).default([]),
  equipment: z.array(z.string()).default([]),
  loot: Reward.prefault({}),
  customFields: z.array(CustomFieldValue).default([])
})

export const ShopEntry = z.object({
  itemId: Id,
  /** Prezzo in quantità dell'oggetto valuta del progetto. */
  price: z.number().int().min(0),
  /** null = scorta illimitata. */
  stock: z.number().int().min(0).nullable().default(null),
  gate: Gate.prefault({})
})

export const Npc = Creature.extend({
  services: z
    .object({
      shop: z.array(ShopEntry).default([]),
      inn: z.string().default(''),
      training: z.string().default('')
    })
    .prefault({})
})
export type Npc = z.infer<typeof Npc>

export const Enemy = Creature.extend({
  creatureType: z.string().default(''),
  environment: z.string().default('')
})
export type Enemy = z.infer<typeof Enemy>

export const Item = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().default(''),
  imageId: Id.nullable().default(null),
  typeId: Id.nullable().default(null),
  weight: z.number().min(0).default(0),
  value: z.number().min(0).default(0),
  stackable: z.boolean().default(false),
  consumable: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  customFields: z.array(CustomFieldValue).default([])
})
export type Item = z.infer<typeof Item>

export const QuestStep = z.object({
  id: Id,
  title: z.string().min(1),
  description: z.string().default(''),
  /** Lo step si completa quando i requisiti sono soddisfatti. */
  requirements: Condition.nullable().default(null)
})
export type QuestStep = z.infer<typeof QuestStep>

export const Quest = z.object({
  id: Id,
  title: z.string().min(1),
  description: z.string().default(''),
  rewards: Reward.prefault({}),
  steps: z.array(QuestStep).default([])
})
export type Quest = z.infer<typeof Quest>

export const Speaker = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('npc') }),
  z.object({ kind: z.literal('player') }),
  z.object({ kind: z.literal('other'), name: z.string() })
])

export const DialogChoice = z.object({
  id: Id,
  text: z.string(),
  /** Battuta di destinazione; null = chiude il dialogo. */
  targetLineId: Id.nullable().default(null),
  gate: Gate.prefault({}),
  effects: z.array(Effect).default([]),
  check: SkillCheck.nullable().default(null)
})
export type DialogChoice = z.infer<typeof DialogChoice>

export const DialogLine = z.object({
  id: Id,
  speaker: Speaker.prefault({ kind: 'npc' }),
  text: z.string().default(''),
  effects: z.array(Effect).default([]),
  /** Zero scelte = fine del dialogo. */
  choices: z.array(DialogChoice).default([]),
  position: Position
})
export type DialogLine = z.infer<typeof DialogLine>

export const Dialog = z.object({
  id: Id,
  npcId: Id,
  title: z.string().min(1),
  startLineId: Id.nullable().default(null),
  lines: z.array(DialogLine).default([])
})
export type Dialog = z.infer<typeof Dialog>
