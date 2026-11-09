import { useState } from 'react'
import { Dices, Lock, LockOpen } from 'lucide-react'
import type { Effect, Gate, SkillCheck } from '@shared/model'
import { describeCheck, describeCondition } from '@shared/engine'
import { newId } from '@shared/model'
import { useProject } from '../../lib/entities'
import { AddButton, Button } from '../ui/form'
import { IconButton, cn } from '../ui/primitives'
import { Section, Sheet } from '../ui/Sheet'
import { Trash2 } from 'lucide-react'
import { GateDialog } from './GateDialog'
import { SkillCheckEditor } from './EffectEditor'

/** Riassunto cliccabile di un gate: apre l'editor condizioni (6b). */
export function GateButton({
  gate,
  onChange,
  title,
  prefix = 'Visibile se',
  effects,
  onEffects,
  compact
}: {
  gate: Gate
  onChange(g: Gate): void
  title: string
  prefix?: string
  effects?: Effect[]
  onEffects?(e: Effect[]): void
  compact?: boolean
}) {
  const p = useProject()
  const [open, setOpen] = useState(false)
  const has = gate.condition !== null
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title={has ? `${prefix} ${describeCondition(p, gate.condition)}` : 'Aggiungi condizione'}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-[11.5px]',
          has ? 'bg-acbg text-ac' : 'text-tx3 hover:bg-hover hover:text-tx2'
        )}
      >
        {has ? <Lock size={11} className="flex-none" /> : <LockOpen size={11} className="flex-none" />}
        {!compact && <span className="truncate">{has ? `${prefix} ${describeCondition(p, gate.condition)}` : 'Sempre'}</span>}
        {(effects?.length ?? 0) > 0 && <span className="font-mono text-[10px]">+{effects!.length} eff.</span>}
      </button>
      {open && (
        <GateDialog
          title={title}
          gate={gate}
          effects={onEffects ? (effects ?? []) : undefined}
          onApply={(g, fx) => {
            onChange(g)
            onEffects?.(fx)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export const newCheck = (skillId: string): SkillCheck => ({
  id: newId('check'),
  skillId,
  dc: 12,
  success: { target: null, effects: [] },
  failure: { target: null, effects: [] }
})

/** Chip delle prove alternative + finestra per modificarle. */
export function ChecksButton({
  checks,
  onChange,
  title,
  targetType
}: {
  checks: SkillCheck[]
  onChange(c: SkillCheck[]): void
  title: string
  targetType: 'scene' | null
}) {
  const p = useProject()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(checks)
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setDraft(checks)
          setOpen(true)
        }}
        className={cn('flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold', checks.length ? 'border border-line2 bg-raised text-tx' : 'text-tx3 hover:bg-hover')}
        title="Prove di abilità"
      >
        <Dices size={11} />
        {checks.length ? checks.map((c) => `${describeCheck(p, c).slice(0, 3).toUpperCase()} ${c.dc}`).join(' / ') : 'Prova'}
      </button>
      {open && (
        <Sheet level={1} category="Prove di abilità" title={title} subtitle="Prove alternative: basta superarne una" width={760} height={760} onClose={() => setOpen(false)}>
          <div className="flex flex-col px-5">
            {draft.map((c, i) => (
              <Section
                key={c.id}
                n={i + 1}
                label={`Prova ${i + 1}`}
                right={<IconButton icon={Trash2} size={13} onClick={() => setDraft(draft.filter((x) => x.id !== c.id))} />}
              >
                <SkillCheckEditor check={c} targetType={targetType} onChange={(x) => setDraft(draft.map((y) => (y.id === c.id ? x : y)))} />
              </Section>
            ))}
            <div className="flex items-center justify-between py-3">
              <AddButton onClick={() => setDraft([...draft, newCheck(p.settings.skills[0]?.id ?? '')])}>Prova alternativa</AddButton>
              <div className="flex gap-2">
                <Button onClick={() => setOpen(false)}>Annulla</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onChange(draft)
                    setOpen(false)
                  }}
                >
                  Applica
                </Button>
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
