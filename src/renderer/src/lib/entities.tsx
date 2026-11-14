import { BookText, Flag, KeyRound, MessagesSquare, Music, Package, ScrollText, Skull, Swords, UserRound, Waypoints } from 'lucide-react'
import { Enemy, Flag as FlagSchema, Item, Npc, Quest, makeEncounter, newId, type EntityType, type Gate, type Project } from '@shared/model'
import { entityName } from '@shared/engine'
import type { ComboOption } from '../components/ui/Combobox'
import { TAG_META } from '../components/ui/primitives'
import { useProjectStore } from '../store/project'

// Elenchi di scelta e creazione rapida delle entità ("Crea … nel catalogo").

export const useProject = (): Project => useProjectStore((s) => s.project)!
export const apply = (...args: Parameters<ReturnType<typeof useProjectStore.getState>['apply']>) => useProjectStore.getState().apply(...args)
export const getProject = () => useProjectStore.getState().project!

export const emptyGate = (): Gate => ({ condition: null, whenUnmet: 'hidden', lockedMessage: '' })

export const ENTITY_ICON: Partial<Record<EntityType, typeof UserRound>> = {
  npc: UserRound,
  enemy: Skull,
  item: Package,
  quest: ScrollText,
  dialog: MessagesSquare,
  encounter: Swords,
  scene: Waypoints,
  flag: Flag,
  document: BookText,
  ending: Flag
}

export function options(p: Project, type: EntityType, filter?: (id: string) => boolean): ComboOption[] {
  const typeName = new Map(p.settings.itemTypes.map((t) => [t.id, t.name]))
  const list: ComboOption[] = (() => {
    switch (type) {
      case 'scene':
        return p.scenes.map((s) => {
          const Icon = TAG_META[s.tag].icon
          return { id: s.id, label: s.title, sub: s.groupId ? entityName(p, 'group', s.groupId) : undefined, icon: <Icon size={12} className={TAG_META[s.tag].fg} /> }
        })
      case 'npc':
        return p.npcs.map((n) => ({ id: n.id, label: n.name, sub: n.role, icon: <UserRound size={12} className="text-tx3" /> }))
      case 'enemy':
        return p.enemies.map((n) => ({ id: n.id, label: n.name, sub: n.level, icon: <Skull size={12} className="text-tx3" /> }))
      case 'item':
        return p.items.map((i) => ({
          id: i.id,
          label: i.name,
          sub: i.typeId ? typeName.get(i.typeId) : undefined,
          icon: i.typeId === 'ityp_chiave' ? <KeyRound size={12} className="text-tx3" /> : <Package size={12} className="text-tx3" />
        }))
      case 'quest':
        return p.quests.map((q) => ({ id: q.id, label: q.title, sub: `${q.steps.length} step`, icon: <ScrollText size={12} className="text-tx3" /> }))
      case 'dialog':
        return p.dialogs.map((d) => ({ id: d.id, label: d.title, sub: entityName(p, 'npc', d.npcId), icon: <MessagesSquare size={12} className="text-tx3" /> }))
      case 'encounter':
        return p.encounters.map((e) => ({ id: e.id, label: e.name, sub: `${e.enemies.reduce((n, x) => n + x.quantity, 0)} enemy`, icon: <Swords size={12} className="text-warn" /> }))
      case 'flag':
        return p.flags.map((f) => ({ id: f.id, label: f.name, icon: <Flag size={12} className="text-tx3" /> }))
      case 'skill':
        return p.settings.skills.map((s) => ({ id: s.id, label: s.name, sub: s.ability.toUpperCase() }))
      case 'itemType':
        return p.settings.itemTypes.map((t) => ({ id: t.id, label: t.name }))
      case 'link':
        return p.links.map((l) => ({ id: l.id, label: entityName(p, 'link', l.id), sub: `${entityName(p, 'scene', l.fromSceneId)} → ${entityName(p, 'scene', l.toSceneId)}` }))
      case 'group':
        return p.groups.map((g) => ({ id: g.id, label: g.name, sub: g.parentId ? entityName(p, 'group', g.parentId) : undefined }))
      case 'image':
        return p.images.map((i) => ({ id: i.id, label: i.title || i.fileName, sub: i.fileName }))
      case 'sound':
        return p.sounds.map((s) => ({ id: s.id, label: s.title || s.fileName, sub: s.fileName, icon: <Music size={12} className="text-tx3" /> }))
      case 'conditionType':
        return p.settings.conditionTypes.map((t) => ({ id: t.id, label: t.name }))
      case 'document':
        return p.documents.map((d) => ({ id: d.id, label: d.title }))
      default:
        return []
    }
  })()
  return filter ? list.filter((o) => filter(o.id)) : list
}

/** Crea un'entità di catalogo con il solo nome e ne restituisce l'id. */
export function createEntity(type: EntityType, name: string): string | undefined {
  const label = name.trim() || 'Senza nome'
  switch (type) {
    case 'npc': {
      const id = newId('npc')
      apply('Nuovo NPC', (d) => void d.npcs.push(Npc.parse({ id, name: label })))
      return id
    }
    case 'enemy': {
      const id = newId('enemy')
      apply('Nuovo enemy', (d) => void d.enemies.push(Enemy.parse({ id, name: label })))
      return id
    }
    case 'item': {
      const id = newId('item')
      apply('Nuovo oggetto', (d) => void d.items.push(Item.parse({ id, name: label })))
      return id
    }
    case 'quest': {
      const id = newId('quest')
      apply('Nuova quest', (d) => void d.quests.push(Quest.parse({ id, title: label, steps: [{ id: newId('step'), title: 'Primo step' }] })))
      return id
    }
    case 'flag': {
      const id = newId('flag')
      apply('Nuovo flag', (d) => void d.flags.push(FlagSchema.parse({ id, name: label.replace(/\s+/g, '_').toLowerCase() })))
      return id
    }
    case 'encounter': {
      const encounter = makeEncounter(label)
      apply('Nuovo incontro', (d) => void d.encounters.push(encounter))
      return encounter.id
    }
    default:
      return undefined
  }
}

export const CREATABLE: EntityType[] = ['npc', 'enemy', 'item', 'quest', 'flag', 'encounter']
