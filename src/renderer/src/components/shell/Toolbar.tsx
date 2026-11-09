import { useMemo, useState } from 'react'
import { Check, ChevronDown, CircleAlert, Flag, ListOrdered, OctagonX, Play, Plus, ShieldCheck, Spline, SquareDashed } from 'lucide-react'
import { validate } from '@shared/engine'
import { useProject } from '../../lib/entities'
import { groupSelection } from '../../lib/sceneOps'
import { useKbd } from '../../lib/commands'
import { dockBridge } from '../../dock/bridge'
import { useCommand } from '../../lib/shortcuts'
import { useUiStore } from '../../store/ui'
import { FiltersPopover } from '../search/FiltersPopover'
import { useFilterStore } from '../search/search'
import { SearchBox } from '../search/SearchBox'
import { useClickOutside } from '../ui/form'
import { TAG_META, ToolbarButton, cn } from '../ui/primitives'

const Divider = () => <div className="h-5 w-px bg-line2" />

/** Selettore "Percorso": evidenzia il percorso decisivo di un finale. */
function PathSelector() {
  const p = useProject()
  const ui = useUiStore()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open)
  const ending = p.endings.find((e) => e.id === ui.pathEndingId)
  if (p.endings.length === 0) return null
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex h-7 items-center gap-2 rounded-md border border-line2 px-2.5 text-[12.5px] text-tx2 hover:bg-hover">
        Percorso
        <span className="flex items-center gap-1.5 font-medium text-tx">
          {ending ? (
            <>
              <Flag size={12} style={{ color: ending.color }} />
              {ending.label}
            </>
          ) : (
            'nessuno'
          )}
        </span>
        <ChevronDown size={13} className="text-tx3" />
      </button>
      {open && (
        <div className="absolute top-[34px] right-0 z-20 flex w-[260px] flex-col gap-0.5 rounded-[10px] border border-line2 bg-raised p-1.5 shadow-[var(--shadow)]">
          <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover" onClick={() => (ui.setPathEnding(null), setOpen(false))}>
            <span className="w-3">{!ending && <Check size={12} />}</span>
            Nessun percorso
          </button>
          {p.endings.map((e) => (
            <button key={e.id} type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover" onClick={() => (ui.setPathEnding(e.id), setOpen(false))}>
              <span className="w-3">{ending?.id === e.id && <Check size={12} />}</span>
              <Flag size={12} style={{ color: e.color }} />
              {e.label}
            </button>
          ))}
          {ending && (
            <button
              type="button"
              className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-2 pb-1 text-left text-tx2 hover:text-tx"
              onClick={() => (ui.openSheet({ kind: 'cross', tab: 'progress', onlyPath: true }), setOpen(false))}
            >
              <ListOrdered size={12} />
              Elenca i passaggi
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Toolbar({ onNewScene }: { onNewScene(): void }) {
  const p = useProject()
  const ui = useUiStore()
  const issues = useMemo(() => validate(p), [p])
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const { filters, setFilters } = useFilterStore()

  const playFromStart = () => ui.setView({ kind: 'playtest', startSceneId: null })
  const playFromHere = () => ui.selectedSceneIds[0] && ui.setView({ kind: 'playtest', startSceneId: ui.selectedSceneIds[0] })
  useCommand('playFromStart', playFromStart)
  useCommand('playFromHere', playFromHere)
  useCommand('toggleValidation', () => dockBridge.togglePanel?.('validation'))
  useCommand('crossProgress', () => ui.openSheet({ kind: 'cross', tab: 'progress' }))
  const kbdNewScene = useKbd('newScene')
  const kbdGroup = useKbd('groupSelection')
  const kbdPlay = useKbd('playFromStart')

  return (
    <div className="relative z-[5] flex min-h-11 flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-panel px-3 py-1.5">
      <div className="flex gap-1">
        <ToolbarButton icon={Plus} kbd={kbdNewScene} variant="default" onClick={onNewScene}>
          Nuova scena
        </ToolbarButton>
        <ToolbarButton icon={Spline} title="Trascina dalla maniglia destra di una scena verso un’altra, oppure usa “Collega” nella scheda scena">
          Collega
        </ToolbarButton>
        <ToolbarButton icon={SquareDashed} kbd={kbdGroup} disabled={ui.selectedSceneIds.length === 0} title="Raggruppa le scene selezionate" onClick={() => groupSelection()}>
          Gruppo
        </ToolbarButton>
      </div>
      <Divider />
      <SearchBox />
      <FiltersPopover />
      <div className="flex gap-1">
        {(['neutral', 'safe', 'warning'] as const).map((t) => {
          const Icon = TAG_META[t].icon
          const on = filters.tags.includes(t)
          return (
            <button
              key={t}
              type="button"
              title={`Mostra solo ${TAG_META[t].label}`}
              onClick={() => setFilters({ tags: on ? filters.tags.filter((x) => x !== t) : [...filters.tags, t] })}
              className={cn('flex h-6 items-center gap-[5px] rounded-[5px] px-2 font-mono text-[10px] font-semibold tracking-[.06em]', TAG_META[t].fg, TAG_META[t].bg, on && 'shadow-[0_0_0_1.5px_currentColor]')}
            >
              <Icon size={10} />
              {TAG_META[t].label}
            </button>
          )
        })}
      </div>
      <Divider />
      <ToolbarButton icon={ShieldCheck} variant="outline" className={cn(ui.openPanels.includes('validation') && 'border-ac')} onClick={() => dockBridge.togglePanel?.('validation')}>
        Validazione
        <span className="flex items-center gap-[3px] font-mono text-[11px] font-semibold text-err">
          <OctagonX size={11} />
          {errors}
        </span>
        <span className="flex items-center gap-[3px] font-mono text-[11px] font-semibold text-warn">
          <CircleAlert size={11} />
          {warnings}
        </span>
      </ToolbarButton>
      <div className="flex-1" />
      <PathSelector />
      <ToolbarButton icon={Play} kbd={kbdPlay} variant="primary" onClick={playFromStart} disabled={!p.startSceneId}>
        Playtest
      </ToolbarButton>
    </div>
  )
}
