import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, EyeOff, Lock } from 'lucide-react'
import type { Effect, Gate } from '@shared/model'
import { describeCondition, effectSites, leaves, sourcesOf } from '@shared/engine'
import { useProject } from '../../lib/entities'
import { Button, TextArea } from '../ui/form'
import { Section, Sheet } from '../ui/Sheet'
import { cn } from '../ui/primitives'
import { ConditionTree } from './ConditionEditor'
import { EffectList } from './EffectEditor'

/**
 * Editor condizioni ed effetti (6b): condizione E/O, comportamento se non soddisfatta,
 * effetti opzionali; a destra la frase "in parole" e la verifica di raggiungibilità.
 */
export function GateDialog({
  title,
  category = 'Condizioni ed effetti',
  subtitle,
  gate,
  effects,
  effectsLabel = 'Effetti al passaggio',
  conditionLabel = 'Condizione',
  showWhenUnmet = true,
  onApply,
  onClose
}: {
  title: string
  category?: string
  subtitle?: string
  gate: Gate
  effects?: Effect[]
  effectsLabel?: string
  conditionLabel?: string
  showWhenUnmet?: boolean
  onApply(gate: Gate, effects: Effect[]): void
  onClose(): void
}) {
  const p = useProject()
  const [draft, setDraft] = useState(gate)
  const [fx, setFx] = useState(effects ?? [])
  const sites = useMemo(() => effectSites(p), [p])
  const ls = leaves(draft.condition)

  let n = 0
  return (
    <Sheet
      level={1}
      category={category}
      title={title}
      subtitle={subtitle}
      width={1160}
      height={860}
      onClose={onClose}
      bodyClassName="flex"
      footer={
        <span>
          {ls.length} {ls.length === 1 ? 'condizione' : 'condizioni'} · {fx.length} {fx.length === 1 ? 'effetto' : 'effetti'}
        </span>
      }
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5">
        <Section n={++n} label={conditionLabel}>
          <ConditionTree value={draft.condition} onChange={(condition) => setDraft({ ...draft, condition })} />
        </Section>
        {showWhenUnmet && (
          <Section n={++n} label="Se non è soddisfatta">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['hidden', EyeOff, 'Nascosto', 'Il giocatore non lo vede.'],
                  ['locked', Lock, 'Visibile ma bloccato', 'Si vede ma non si può usare.']
                ] as const
              ).map(([v, Icon, label, sub]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft({ ...draft, whenUnmet: v })}
                  className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left', draft.whenUnmet === v ? 'border-ac bg-acbg' : 'border-line2 hover:bg-hover')}
                >
                  <Icon size={15} className={draft.whenUnmet === v ? 'text-ac' : 'text-tx3'} />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-[11.5px] text-tx3">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
            {draft.whenUnmet === 'locked' && (
              <TextArea rows={2} placeholder="Messaggio mostrato quando è bloccato" value={draft.lockedMessage} onCommit={(lockedMessage) => setDraft({ ...draft, lockedMessage })} />
            )}
          </Section>
        )}
        {effects && (
          <Section n={++n} label={effectsLabel}>
            <EffectList effects={fx} onChange={setFx} />
          </Section>
        )}
      </div>
      <aside className="flex w-[340px] flex-none flex-col gap-4 overflow-y-auto border-l border-line bg-sunken p-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">IN PAROLE</span>
          <p className="m-0 text-[13px] leading-[1.6]">
            {draft.condition ? (
              <>
                Si può usare se <b className="font-semibold text-ac">{describeCondition(p, draft.condition)}</b>.
              </>
            ) : (
              'Nessuna condizione: sempre disponibile.'
            )}
            {draft.condition && draft.whenUnmet === 'locked' && ' Altrimenti resta visibile ma bloccato.'}
            {draft.condition && draft.whenUnmet === 'hidden' && ' Altrimenti è nascosto.'}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">VERIFICA</span>
          {ls.length === 0 && <span className="text-tx3">Niente da verificare.</span>}
          {ls.map((leaf, i) => {
            const src = sourcesOf(p, leaf, sites)
            return (
              <div key={i} className="flex gap-2 text-[12.5px] leading-[1.5]">
                {src.length ? <CircleCheck size={14} className="mt-0.5 flex-none text-safe" /> : <CircleAlert size={14} className="mt-0.5 flex-none text-warn" />}
                <span>
                  <span className="text-tx">{describeCondition(p, leaf)}</span>
                  <span className="block text-tx3">
                    {src.length ? `Ottenibile da: ${src.slice(0, 3).map((s) => `${s.label} (${s.where})`).join(', ')}${src.length > 3 ? '…' : ''}` : 'Nessuno la rende vera: condizione impossibile.'}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-auto flex justify-end gap-2">
          <Button onClick={onClose}>Annulla</Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply(draft, fx)
              onClose()
            }}
          >
            Applica
          </Button>
        </div>
      </aside>
    </Sheet>
  )
}
