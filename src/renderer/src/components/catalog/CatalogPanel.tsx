import { useMemo, type ReactNode } from 'react'
import { KeyRound, Package, Plus, ScrollText, Search } from 'lucide-react'
import { buildUsageIndex, type Project } from '@shared/model'
import { createEntity } from '../../lib/entities'
import { useProjectStore } from '../../store/project'
import { openEntity, useUiStore, type CatalogTab } from '../../store/ui'
import { CATALOG_DRAG_TYPE } from '../graph/GraphCanvas'
import { IconButton, cn } from '../ui/primitives'

const TABS: [CatalogTab, string][] = [
  ['all', 'Tutti'],
  ['npc', 'NPC'],
  ['enemy', 'Enemy'],
  ['item', 'Oggetti'],
  ['quest', 'Quest']
]

interface Row {
  id: string
  name: string
  sub: string
  usage: string
  unused: boolean
  thumb: ReactNode
}

const Portrait = ({ round }: { round?: boolean }) => (
  <span className={cn('stripes size-8 flex-none border border-line2', round ? 'rounded-full' : 'rounded-md')} />
)

const IconThumb = ({ children }: { children: ReactNode }) => (
  <span className="grid size-8 flex-none place-items-center rounded-md border border-line2 bg-sunken text-tx2">{children}</span>
)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function sections(project: Project): [CatalogTab, string, Row[]][] {
  const usage = buildUsageIndex(project)
  const scenesUsing = (id: string) => (usage.get(id) ?? []).filter((o) => o.type === 'scene').length
  const uses = (id: string) => (usage.get(id) ?? []).length
  const typeName = new Map(project.settings.itemTypes.map((t) => [t.id, t.name]))
  const encounterScenes = (enemyId: string) =>
    project.scenes.filter((s) =>
      s.encounterIds.some((e) => project.encounters.find((x) => x.id === e)?.enemies.some((x) => x.enemyId === enemyId))
    ).length

  return [
    [
      'npc',
      'NPC',
      project.npcs.map((n) => {
        const dialogs = project.dialogs.filter((d) => d.npcId === n.id).length
        const scenes = scenesUsing(n.id)
        const extra = n.services.shop.length ? 'negozio' : plural(dialogs, 'dialogo', 'dialoghi')
        return { id: n.id, name: n.name, sub: [n.role, extra].filter(Boolean).join(' · '), usage: plural(scenes, 'scena', 'scene'), unused: scenes === 0, thumb: <Portrait round /> }
      })
    ],
    [
      'enemy',
      'Enemy',
      project.enemies.map((e) => {
        const scenes = encounterScenes(e.id)
        return { id: e.id, name: e.name, sub: [e.creatureType, e.level].filter(Boolean).join(' · '), usage: plural(scenes, 'scena', 'scene'), unused: scenes === 0, thumb: <Portrait /> }
      })
    ],
    [
      'item',
      'Oggetti',
      project.items.map((i) => {
        const n = uses(i.id)
        const type = i.typeId ? typeName.get(i.typeId) : undefined
        return {
          id: i.id,
          name: i.name,
          sub: [type, i.value ? `${i.value} mo` : null].filter(Boolean).join(' · '),
          usage: plural(n, 'uso', 'usi'),
          unused: n === 0,
          thumb: <IconThumb>{type === 'Chiave' ? <KeyRound size={14} /> : <Package size={14} />}</IconThumb>
        }
      })
    ],
    [
      'quest',
      'Quest',
      project.quests.map((q) => {
        const n = uses(q.id)
        return { id: q.id, name: q.title, sub: plural(q.steps.length, 'step', 'step'), usage: plural(n, 'uso', 'usi'), unused: n === 0, thumb: <IconThumb><ScrollText size={14} /></IconThumb> }
      })
    ]
  ]
}

/** Scheda catalogo: riempie lo spazio della scheda del dock. */
export function CatalogPanel() {
  const project = useProjectStore((s) => s.project)!
  const { catalogTab, catalogQuery, setCatalogTab, setCatalogQuery } = useUiStore()
  const all = useMemo(() => sections(project), [project])

  const q = catalogQuery.trim().toLowerCase()
  const visible = all
    .filter(([tab]) => catalogTab === 'all' || catalogTab === tab)
    .map(([tab, title, rows]) => [tab, title, rows.filter((r) => !q || r.name.toLowerCase().includes(q))] as const)

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-11 flex-none items-center justify-between border-b border-line pr-3 pl-4">
        <span className="font-mono text-[10.5px] font-semibold tracking-[.1em] text-tx3">CATALOGO</span>
        <div className="flex gap-0.5">
          <IconButton
            icon={Plus}
            className="size-[26px]"
            title={`Nuovo ${catalogTab === 'all' ? 'NPC' : TABS.find(([t]) => t === catalogTab)![1]}`}
            onClick={() => {
              const type = catalogTab === 'all' ? 'npc' : catalogTab
              const id = createEntity(type, type === 'npc' ? 'Nuovo NPC' : type === 'enemy' ? 'Nuovo enemy' : type === 'item' ? 'Nuovo oggetto' : 'Nuova quest')
              if (id) openEntity(type, id)
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
        <label className="flex h-[30px] items-center gap-2 rounded-md border border-line2 bg-sunken px-2.5 text-tx3 focus-within:border-ac">
          <Search size={13} />
          <input
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Cerca per nome"
            className="min-w-0 flex-1 bg-transparent text-tx outline-none placeholder:text-tx3"
          />
        </label>
        <div className="flex rounded-[7px] border border-line bg-sunken p-0.5 text-xs text-tx2">
          {TABS.map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCatalogTab(tab)}
              className={cn('flex-1 rounded-[5px] py-1', catalogTab === tab && 'bg-raised text-tx shadow-[0_1px_2px_rgba(0,0,0,.2)]')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1.5 pb-2">
        {visible.map(([tab, title, rows]) => (
          <section key={tab} className="flex flex-col gap-px">
            <div className="px-2.5 pt-3 pb-1.5 font-mono text-[10px] font-semibold tracking-[.08em] text-tx3 uppercase">
              {title} · {rows.length}
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                draggable={tab !== 'quest'}
                onDragStart={(e) => {
                  e.dataTransfer.setData(CATALOG_DRAG_TYPE, JSON.stringify({ type: tab, id: r.id }))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => openEntity(tab as 'npc', r.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-hover"
              >
                {r.thumb}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-[11.5px] text-tx3">{r.sub || '—'}</div>
                </div>
                <span className={cn('font-mono text-[10.5px] font-medium', r.unused ? 'text-err' : 'text-tx3')}>{r.usage}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="border-t border-line px-4 py-2.5 text-[11.5px] text-tx3">Trascina una voce su una scena per aggiungerla.</div>
    </div>
  )
}
