import type { EntityType } from './ids'
import type { Project } from './project'

// Indice inverso "Usato in": per ogni id, le entità di primo livello che lo riferiscono.

export interface Owner {
  type: EntityType
  id: string
  label: string
}

/** Link a un'entità nei documenti: `@[Testo visibile](tipo:id)`. Gruppi: 1 testo, 2 tipo, 3 id. */
export const DOC_LINK = /@\[([^\]]*)\]\((\w+):([\w-]+)\)/g

function owners(project: Project): [Owner, unknown][] {
  return [
    ...project.scenes.map((e): [Owner, unknown] => [{ type: 'scene', id: e.id, label: e.title }, e]),
    ...project.links.map((e): [Owner, unknown] => [{ type: 'link', id: e.id, label: e.label || 'Collegamento' }, e]),
    ...project.groups.map((e): [Owner, unknown] => [{ type: 'group', id: e.id, label: e.name }, e]),
    ...project.endings.map((e): [Owner, unknown] => [{ type: 'ending', id: e.id, label: e.label }, e]),
    ...project.encounters.map((e): [Owner, unknown] => [{ type: 'encounter', id: e.id, label: e.name }, e]),
    ...project.npcs.map((e): [Owner, unknown] => [{ type: 'npc', id: e.id, label: e.name }, e]),
    ...project.enemies.map((e): [Owner, unknown] => [{ type: 'enemy', id: e.id, label: e.name }, e]),
    ...project.items.map((e): [Owner, unknown] => [{ type: 'item', id: e.id, label: e.name }, e]),
    ...project.quests.map((e): [Owner, unknown] => [{ type: 'quest', id: e.id, label: e.title }, e]),
    ...project.dialogs.map((e): [Owner, unknown] => [{ type: 'dialog', id: e.id, label: e.title }, e]),
    ...project.presets.map((e): [Owner, unknown] => [{ type: 'preset', id: e.id, label: e.name }, e])
  ]
}

/** Raccoglie le stringhe che sono id noti, escludendo il campo `id` del nodo stesso. */
function collect(value: unknown, known: Set<string>, out: Set<string>): void {
  if (typeof value === 'string') {
    if (known.has(value)) out.add(value)
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, known, out)
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) if (key !== 'id') collect(v, known, out)
  }
}

export function buildUsageIndex(project: Project): Map<string, Owner[]> {
  const all = owners(project)
  const known = new Set<string>([
    ...all.map(([o]) => o.id),
    ...project.images.map((i) => i.id),
    ...project.sounds.map((s) => s.id),
    ...project.flags.map((f) => f.id),
    ...project.quests.flatMap((q) => q.steps.map((s) => s.id)),
    ...project.dialogs.flatMap((d) => d.lines.flatMap((l) => [l.id, ...l.choices.map((c) => c.id)]))
  ])
  const index = new Map<string, Owner[]>()
  const add = (id: string, owner: Owner) => {
    if (id === owner.id) return
    const list = index.get(id) ?? []
    if (!list.some((o) => o.id === owner.id)) list.push(owner)
    index.set(id, list)
  }

  for (const [owner, entity] of all) {
    const refs = new Set<string>()
    collect(entity, known, refs)
    // Gli elementi interni (step, battute, scelte) non contano come riferimenti di chi li contiene.
    if (owner.type === 'quest') project.quests.find((q) => q.id === owner.id)?.steps.forEach((s) => refs.delete(s.id))
    if (owner.type === 'dialog') {
      project.dialogs
        .find((d) => d.id === owner.id)
        ?.lines.forEach((l) => {
          refs.delete(l.id)
          l.choices.forEach((c) => refs.delete(c.id))
        })
    }
    refs.forEach((id) => add(id, owner))
  }

  for (const doc of project.documents) {
    const owner: Owner = { type: 'document', id: doc.id, label: doc.title }
    for (const match of doc.markdown.matchAll(DOC_LINK)) if (match[3]) add(match[3], owner)
  }
  return index
}
