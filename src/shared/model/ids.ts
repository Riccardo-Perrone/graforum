import { customAlphabet } from 'nanoid'
import { z } from 'zod'

/** Prefisso di ogni tipo di entità: l'id resta stabile anche rinominando. */
export const ID_PREFIX = {
  project: 'prj',
  scene: 'scn',
  link: 'lnk',
  group: 'grp',
  ending: 'end',
  npc: 'npc',
  enemy: 'eny',
  item: 'itm',
  quest: 'qst',
  step: 'stp',
  dialog: 'dlg',
  dialogLine: 'dln',
  dialogChoice: 'dch',
  encounter: 'enc',
  image: 'img',
  flag: 'flg',
  check: 'chk',
  sceneItem: 'sit',
  document: 'doc',
  preset: 'pre',
  conditionType: 'ctp',
  skill: 'skl',
  itemType: 'ityp',
  customField: 'cfd',
  sceneLabel: 'lbl'
} as const

export type EntityType = keyof typeof ID_PREFIX

const random = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10)

export function newId(type: EntityType): string {
  return `${ID_PREFIX[type]}_${random()}`
}

export const Id = z.string().min(1)

export const EntityTypeSchema = z.enum(Object.keys(ID_PREFIX) as [EntityType, ...EntityType[]])

/** Riferimento generico a un'entità del progetto. */
export const Ref = z.object({ type: EntityTypeSchema, id: Id })
export type Ref = z.infer<typeof Ref>
