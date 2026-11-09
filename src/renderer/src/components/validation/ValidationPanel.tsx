import { useMemo, useState } from 'react'
import { CircleAlert, Info, OctagonX, RefreshCw, Wrench } from 'lucide-react'
import { newId } from '@shared/model'
import { validate, type Issue, type Severity } from '@shared/engine'
import { dockBridge } from '../../dock/bridge'
import { apply, useProject } from '../../lib/entities'
import { openEntity, useUiStore } from '../../store/ui'
import { Segmented } from '../ui/form'
import { IconButton, cn } from '../ui/primitives'
import { SheetHeader } from '../ui/Sheet'

const ICON = { error: OctagonX, warning: CircleAlert, note: Info }
const COLOR = { error: 'text-err', warning: 'text-warn', note: 'text-tx3' }

/** Correzione rapida per i problemi più comuni. */
function quickFix(issue: Issue): { label: string; run(): void } | null {
  const id = issue.target.id
  switch (issue.title) {
    case 'Scena di partenza mancante':
      return { label: 'Usa la prima scena', run: () => apply('Scena di partenza', (d) => void (d.startSceneId = d.scenes[0]?.id ?? null)) }
    case 'Scena Warning senza incontro':
      return {
        label: 'Aggiungi incontro',
        run: () => {
          const encId = newId('encounter')
          apply('Nuovo incontro', (d) => {
            const s = d.scenes.find((x) => x.id === id)!
            d.encounters.push({ id: encId, name: `Incontro in ${s.title}`, enemies: [], nature: 'unique', rewards: { xp: 0, items: [] }, outcomes: { win: { target: null, effects: [] }, flee: { target: null, effects: [] }, defeat: { target: null, effects: [] } } })
            s.encounterIds.push(encId)
          })
          openEntity('scene', id)
        }
      }
    case 'Vicolo cieco':
      return {
        label: 'Segna come finale',
        run: () => apply('Scena finale', (d) => void d.endings.push({ id: newId('ending'), sceneId: id, label: 'Nuovo finale', color: '#e9c64a', manualDecisive: [] }))
      }
    case 'Gruppo senza entrata':
      return { label: 'Prima scena come entrata', run: () => apply('Entrata gruppo', (d) => {
        const g = d.groups.find((x) => x.id === id)!
        const s = d.scenes.find((x) => x.groupId === g.id)
        if (s) g.entrySceneIds.push(s.id)
      }) }
    case 'Gruppo senza uscita':
      return { label: 'Prima scena come uscita', run: () => apply('Uscita gruppo', (d) => {
        const g = d.groups.find((x) => x.id === id)!
        const s = d.scenes.find((x) => x.groupId === g.id)
        if (s) g.exitSceneIds.push(s.id)
      }) }
    default:
      return null
  }
}

/** Scheda validazione (6e): elenco cliccabile, il nodo viene inquadrato. */
export function ValidationPanel() {
  const p = useProject()
  const ui = useUiStore()
  const [filter, setFilter] = useState<'all' | Severity>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const issues = useMemo(() => validate(p), [p, nonce])
  const count = (s: Severity) => issues.filter((i) => i.severity === s).length
  const shown = issues.filter((i) => filter === 'all' || i.severity === filter)
  const groups: [Severity, string][] = [
    ['error', 'ERRORI · BLOCCANO L’ESPORTAZIONE'],
    ['warning', 'AVVISI'],
    ['note', 'NOTE']
  ]

  const focus = (i: Issue) => {
    setSelected(i.id)
    if (i.sceneId) {
      ui.focusScene(i.sceneId)
      ui.setHighlight({ sceneIds: new Set([i.sceneId]), label: i.title })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <SheetHeader
        category="Validazione"
        title={`${issues.length} problemi in ${p.scenes.length} scene`}
        actions={<IconButton icon={RefreshCw} size={13} title="Ricalcola" onClick={() => setNonce(nonce + 1)} />}
        onClose={() => (dockBridge.closePanel?.('validation'), ui.setHighlight(null))}
      />
      <div className="border-b border-line p-3">
        <Segmented
          value={filter}
          options={[
            ['all', `Tutti ${issues.length}`],
            ['error', `Errori ${count('error')}`],
            ['warning', `Avvisi ${count('warning')}`],
            ['note', `Note ${count('note')}`]
          ]}
          onChange={(v) => setFilter(v as 'all' | Severity)}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" data-text-scale>
        {shown.length === 0 && <div className="p-3 text-safe">Nessun problema. Ottimo lavoro.</div>}
        {groups.map(([sev, label]) => {
          const list = shown.filter((i) => i.severity === sev)
          if (list.length === 0) return null
          const Icon = ICON[sev]
          return (
            <div key={sev} className="flex flex-col gap-1.5">
              <span className={cn('px-1 font-mono text-[10px] font-semibold tracking-[.08em]', COLOR[sev])}>{label}</span>
              {list.map((i) => {
                const fix = quickFix(i)
                return (
                  <div
                    key={i.id}
                    onClick={() => focus(i)}
                    className={cn('flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5', selected === i.id ? (sev === 'error' ? 'border-err bg-errbg' : 'border-ac bg-acbg') : 'border-line2 hover:bg-hover')}
                  >
                    <span className={cn('flex items-center gap-1.5 font-semibold', COLOR[sev])}>
                      <Icon size={13} />
                      {i.title}
                    </span>
                    <span className="text-[12px] text-tx2">{i.detail}</span>
                    <span className="flex items-center gap-3 text-[11.5px]">
                      <button type="button" className="text-ac hover:underline" onClick={(e) => (e.stopPropagation(), openEntity(i.target.type, i.target.id))}>
                        Apri
                      </button>
                      {fix && (
                        <button type="button" className="flex items-center gap-1 text-tx2 hover:text-tx" onClick={(e) => (e.stopPropagation(), fix.run())}>
                          <Wrench size={11} />
                          {fix.label}
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="border-t border-line px-4 py-2 font-mono text-[11px] text-tx3">Ricalcolata a ogni modifica · Ctrl Maiusc M</div>
    </div>
  )
}
