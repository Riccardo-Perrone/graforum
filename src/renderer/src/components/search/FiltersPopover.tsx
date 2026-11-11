import { useEffect, useState } from 'react'
import { ListFilter, Trash2 } from 'lucide-react'
import type { EntityType } from '@shared/model'
import { options, useProject } from '../../lib/entities'
import { useUiStore } from '../../store/ui'
import { Combobox } from '../ui/Combobox'
import { Button, Segmented, Select, TextInput, Toggle, useClickOutside } from '../ui/form'
import { IconButton, TAG_META, ToolbarButton, cn } from '../ui/primitives'
import { SearchInput } from '../ui/SearchInput'
import { filterScenes, filtersActive, useFilterStore } from './search'

const ENTITY_TYPES = [
  ['npc', 'NPC'],
  ['item', 'Oggetto'],
  ['quest', 'Quest'],
  ['enemy', 'Enemy'],
  ['flag', 'Flag'],
  ['dialog', 'Dialogo']
] as const

/** Filtri (6f): si combinano; le scene escluse si attenuano o si nascondono, le posizioni non cambiano mai. */
export function FiltersPopover() {
  const p = useProject()
  const ui = useUiStore()
  const { filters, setFilters, reset, save, remove } = useFilterStore()
  const saved = useUiStore((s) => s.savedFilters)
  const [open, setOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number][0]>('npc')
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open)
  const active = filtersActive(filters)

  useEffect(() => {
    if (!active) {
      if (ui.highlight?.label.startsWith('Filtri')) ui.setHighlight(null)
      return
    }
    const ids = filterScenes(p, filters)
    ui.setHighlight({ sceneIds: ids, label: `Filtri: ${ids.size} scene`, hideOthers: filters.hide })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, filters, active])

  const toggleTag = (t: (typeof filters.tags)[number]) => setFilters({ tags: filters.tags.includes(t) ? filters.tags.filter((x) => x !== t) : [...filters.tags, t] })

  return (
    <div className="relative" ref={ref}>
      <ToolbarButton icon={ListFilter} variant="outline" className={cn(active && 'border-ac text-ac')} onClick={() => setOpen(!open)}>
        Filtri{active ? ' ·' : ''}
      </ToolbarButton>
      {open && (
        <div className="absolute top-[34px] left-0 z-20 flex w-[380px] flex-col gap-3 rounded-[10px] border border-line2 bg-raised p-3 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">FILTRI DEL GRAFO</span>
            <button type="button" className="text-[11.5px] text-tx2 hover:text-tx" onClick={reset}>
              Reimposta
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-tx3">Tag</span>
            <div className="flex gap-1">
              {(['neutral', 'safe', 'warning'] as const).map((t) => {
                const Icon = TAG_META[t].icon
                const on = filters.tags.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={cn('flex h-6 items-center gap-1 rounded-[5px] border px-2 font-mono text-[10px] font-semibold tracking-[.06em]', on ? `${TAG_META[t].bg} ${TAG_META[t].fg} border-transparent` : 'border-line2 text-tx3')}
                  >
                    <Icon size={10} />
                    {TAG_META[t].label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-tx3">Contenuto</span>
            <Toggle checked={filters.withConditions} onChange={(v) => setFilters({ withConditions: v })} label="Ha condizioni" />
            <Toggle checked={filters.withChecks} onChange={(v) => setFilters({ withChecks: v })} label="Ha prove di abilità" />
            <Toggle checked={filters.withProblems} onChange={(v) => setFilters({ withProblems: v })} label="Ha problemi di validazione" />
            <Toggle checked={filters.endingsOnly} onChange={(v) => setFilters({ endingsOnly: v })} label="Solo finali" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-tx3">Usa l’entità</span>
            <div className="flex gap-1.5">
              <Select className="w-[110px]" value={entityType} options={ENTITY_TYPES} onChange={(t) => setEntityType(t)} />
              <Combobox
                className="flex-1"
                allowClear
                placeholder="Qualsiasi"
                value={filters.entity?.id ?? null}
                options={options(p, entityType as EntityType)}
                onChange={(id) => setFilters({ entity: id ? { type: entityType as EntityType, id } : null })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-tx3">Gruppo</span>
              <Combobox allowClear placeholder="Tutti" value={filters.groupId} options={options(p, 'group')} onChange={(id) => setFilters({ groupId: id })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-tx3">Testo</span>
              <SearchInput value={filters.text} placeholder="Titolo o descrizione" onChange={(text) => setFilters({ text })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-tx3">Scene escluse</span>
            <Segmented
              value={filters.hide ? 'hide' : 'dim'}
              options={[
                ['dim', 'Attenua'],
                ['hide', 'Nascondi']
              ]}
              onChange={(v) => setFilters({ hide: v === 'hide' })}
            />
          </div>
          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
            <span className="text-[11.5px] text-tx3">Viste salvate</span>
            {saved.map((s) => (
              <div key={s.name} className="flex items-center gap-1">
                <button type="button" className="flex-1 truncate text-left hover:text-ac" onClick={() => setFilters(s.filters)}>
                  {s.name}
                </button>
                <IconButton icon={Trash2} size={12} onClick={() => remove(s.name)} />
              </div>
            ))}
            <div className="flex gap-1.5">
              <TextInput className="flex-1" placeholder="Nome della vista" value={viewName} onCommit={setViewName} />
              <Button disabled={!active || !viewName.trim()} onClick={() => (save(viewName.trim()), setViewName(''))}>
                Salva come vista
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
