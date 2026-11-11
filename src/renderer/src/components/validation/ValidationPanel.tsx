import { useState } from 'react'
import { CircleAlert, Info, OctagonX, Wrench } from 'lucide-react'
import { makeEncounter, makeEnding } from '@shared/model'
import { groupDescendants, validateCached, type Issue, type Severity } from '@shared/engine'
import { dockBridge } from '../../dock/bridge'
import { apply, useProject } from '../../lib/entities'
import { deleteEncounters } from '../../lib/sceneOps'
import { useKbd } from '../../lib/commands'
import { openEntity, useUiStore } from '../../store/ui'
import { Segmented } from '../ui/form'
import { cn } from '../ui/primitives'
import { SheetHeader } from '../ui/Sheet'

const ICON = { error: OctagonX, warning: CircleAlert, note: Info }
const COLOR = { error: 'text-err', warning: 'text-warn', note: 'text-tx3' }

/** Prima scena del gruppo o dei suoi sottogruppi, in ordine di elenco. */
const firstSceneIn = (d: { groups: { id: string; parentId: string | null }[]; scenes: { id: string; groupId: string | null }[] }, groupId: string) => {
  const ids = groupDescendants(d.groups, groupId)
  return d.scenes.find((s) => s.groupId !== null && ids.has(s.groupId))
}

/** Correzione rapida (pulsante con la chiave inglese accanto al problema), scelta dal codice stabile del problema. */
function quickFix(issue: Issue): { label: string; run(): void } | null {
  const id = issue.target.id
  switch (issue.code) {
    case 'missingStart':
      return { label: 'Usa la prima scena', run: () => apply('Scena di partenza', (d) => void (d.startSceneId = d.scenes[0]?.id ?? null)) }
    case 'warningWithoutEncounter':
      return {
        label: 'Aggiungi incontro',
        run: () => {
          apply('Nuovo incontro', (d) => {
            const s = d.scenes.find((x) => x.id === id)!
            const encounter = makeEncounter(`Incontro in ${s.title}`)
            d.encounters.push(encounter)
            s.encounterIds.push(encounter.id)
          })
          openEntity('scene', id)
        }
      }
    case 'deadEnd':
      return {
        label: 'Segna come finale',
        run: () => apply('Scena finale', (d) => void d.endings.push(makeEnding(id, d.endings.length)))
      }
    case 'groupWithoutEntry':
      return {
        label: 'Prima scena come entrata',
        run: () =>
          apply('Entrata gruppo', (d) => {
            const s = firstSceneIn(d, id)
            if (s) d.groups.find((x) => x.id === id)!.entrySceneIds.push(s.id)
          })
      }
    case 'groupWithoutExit':
      return {
        label: 'Prima scena come uscita',
        run: () =>
          apply('Uscita gruppo', (d) => {
            const s = firstSceneIn(d, id)
            if (s) d.groups.find((x) => x.id === id)!.exitSceneIds.push(s.id)
          })
      }
    case 'encounterWithoutScene':
      return { label: 'Elimina incontro', run: () => void deleteEncounters([id]) }
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
  // Ricalcolata a ogni modifica del progetto (stesso risultato di barra di stato, toolbar e grafo).
  const issues = validateCached(p)
  const kbdToggle = useKbd('toggleValidation')
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
      <div className="border-t border-line px-4 py-2 font-mono text-[11px] text-tx3">Ricalcolata a ogni modifica{kbdToggle ? ` · ${kbdToggle}` : ''}</div>
    </div>
  )
}
