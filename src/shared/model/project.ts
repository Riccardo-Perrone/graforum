import { z } from 'zod'
import { Id, Ref } from './ids'
import { QuestState } from './logic'
import { Encounter, Ending, Group, Link, Scene, SceneLabel } from './graph'
import { Dialog, Enemy, Item, Npc, Quest } from './catalog'

// Progetto, libreria, impostazioni: §2, §6, §7 di docs/modello-dati-v3.md.

export const SCHEMA_VERSION = 1

export const Image = z.object({
  id: Id,
  fileName: z.string(),
  title: z.string().default(''),
  tags: z.array(z.string()).default([]),
  mime: z.string(),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null)
})
export type Image = z.infer<typeof Image>

export const Flag = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().default(''),
  defaultValue: z.boolean().default(false)
})
export type Flag = z.infer<typeof Flag>

/** Documento di progetto in Markdown; link alle entità: `@[Testo](tipo:id)`. */
export const ProjectDocument = z.object({
  id: Id,
  title: z.string().min(1),
  markdown: z.string().default(''),
  order: z.number().default(0)
})
export type ProjectDocument = z.infer<typeof ProjectDocument>

export const Preset = z.object({
  id: Id,
  name: z.string().min(1),
  items: z.array(z.object({ itemId: Id, quantity: z.number().int().min(1) })).default([]),
  quests: z.array(z.object({ questId: Id, stepId: Id.nullable().default(null), state: QuestState })).default([]),
  flags: z.array(z.object({ flagId: Id, value: z.boolean() })).default([])
})
export type Preset = z.infer<typeof Preset>

export const Skill = z.object({
  id: Id,
  name: z.string().min(1),
  ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])
})
export type Skill = z.infer<typeof Skill>

export const ItemType = z.object({ id: Id, name: z.string().min(1) })

export const CustomFieldDef = z.object({
  id: Id,
  appliesTo: z.enum(['npc', 'enemy', 'item']),
  name: z.string().min(1),
  kind: z.enum(['text', 'number', 'boolean', 'choice']),
  options: z.array(z.string()).default([])
})
export type CustomFieldDef = z.infer<typeof CustomFieldDef>

export const CustomConditionType = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().default(''),
  params: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        kind: z.enum(['text', 'number', 'boolean', 'entity']),
        entityType: Ref.shape.type.nullable().default(null)
      })
    )
    .default([])
})
export type CustomConditionType = z.infer<typeof CustomConditionType>

export const ProjectSettings = z.object({
  skills: z.array(Skill).default([]),
  itemTypes: z.array(ItemType).default([]),
  currencyItemId: Id.nullable().default(null),
  customFields: z.array(CustomFieldDef).default([]),
  conditionTypes: z.array(CustomConditionType).default([]),
  sceneLabels: z.array(SceneLabel).default([])
})
export type ProjectSettings = z.infer<typeof ProjectSettings>

export const Project = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  name: z.string().min(1),
  description: z.string().default(''),
  startSceneId: Id.nullable().default(null),
  settings: ProjectSettings.prefault({}),
  scenes: z.array(Scene).default([]),
  links: z.array(Link).default([]),
  groups: z.array(Group).default([]),
  endings: z.array(Ending).default([]),
  encounters: z.array(Encounter).default([]),
  npcs: z.array(Npc).default([]),
  enemies: z.array(Enemy).default([]),
  items: z.array(Item).default([]),
  quests: z.array(Quest).default([]),
  dialogs: z.array(Dialog).default([]),
  images: z.array(Image).default([]),
  flags: z.array(Flag).default([]),
  documents: z.array(ProjectDocument).default([]),
  presets: z.array(Preset).default([])
})
export type Project = z.infer<typeof Project>
export type ProjectInput = z.input<typeof Project>
