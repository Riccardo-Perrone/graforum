import { Trash2, Zap } from 'lucide-react'
import type { Effect, EntityType, Project, SkillCheck } from '@shared/model'
import { describeEffect } from '@shared/engine'
import { CREATABLE, createEntity, options, useProject } from '../../lib/entities'
import { Combobox } from '../ui/Combobox'
import { AddButton, NumberInput, Select, TextInput } from '../ui/form'
import { IconButton } from '../ui/primitives'
import { Empty } from '../ui/Sheet'

// Elenco di effetti e prova di abilità (§3 del modello v3).

const EFFECT_TYPES = [
  ['gainItem', 'Ottiene oggetto'],
  ['loseItem', 'Perde oggetto'],
  ['questStart', 'Avvia quest'],
  ['questAdvance', 'Avanza quest'],
  ['questComplete', 'Completa quest/step'],
  ['unlock', 'Sblocca'],
  ['lock', 'Blocca'],
  ['setFlag', 'Imposta flag'],
  ['freeText', 'Personalizzato']
] as const

function defaultEffect(p: Project, type: Effect['type']): Effect {
  switch (type) {
    case 'gainItem':
    case 'loseItem':
      return { type, itemId: p.items[0]?.id ?? '', quantity: 1 }
    case 'questStart':
      return { type, questId: p.quests[0]?.id ?? '' }
    case 'questAdvance':
    case 'questComplete':
      return { type, questId: p.quests[0]?.id ?? '', stepId: null }
    case 'unlock':
    case 'lock':
      return { type, target: { type: 'link', id: p.links[0]?.id ?? '' } }
    case 'setFlag':
      return { type, flagId: p.flags[0]?.id ?? '', value: true }
    case 'freeText':
      return { type, text: '' }
  }
}

function Pick({ type, value, onChange }: { type: EntityType; value: string; onChange(id: string): void }) {
  const p = useProject()
  return (
    <Combobox
      className="min-w-[min(100%,10rem)] max-w-full flex-1"
      value={value || null}
      options={options(p, type)}
      onChange={(id) => id && onChange(id)}
      onCreate={CREATABLE.includes(type) ? (name) => createEntity(type, name) : undefined}
    />
  )
}

export function EffectRow({ effect, onChange, onRemove }: { effect: Effect; onChange(e: Effect): void; onRemove(): void }) {
  const p = useProject()
  const body = (() => {
    switch (effect.type) {
      case 'gainItem':
      case 'loseItem':
        return (
          <>
            <Pick type="item" value={effect.itemId} onChange={(itemId) => onChange({ ...effect, itemId })} />
            <span className="text-tx3">×</span>
            <NumberInput className="w-16" min={1} value={effect.quantity} onCommit={(q) => onChange({ ...effect, quantity: q ?? 1 })} />
          </>
        )
      case 'questStart':
        return <Pick type="quest" value={effect.questId} onChange={(questId) => onChange({ ...effect, questId })} />
      case 'questAdvance':
      case 'questComplete': {
        const quest = p.quests.find((q) => q.id === effect.questId)
        return (
          <>
            <Pick type="quest" value={effect.questId} onChange={(questId) => onChange({ ...effect, questId, stepId: null })} />
            <Select
              className="w-[170px] max-w-full"
              value={effect.stepId ?? ''}
              options={[['', effect.type === 'questAdvance' ? 'step successivo' : 'quest intera'] as const, ...(quest?.steps.map((s, i) => [s.id, `step ${i + 1} · ${s.title}`] as const) ?? [])]}
              onChange={(v) => onChange({ ...effect, stepId: v || null })}
            />
          </>
        )
      }
      case 'unlock':
      case 'lock':
        return (
          <>
            <Select
              className="w-[120px] max-w-full"
              value={effect.target.type === 'scene' ? 'scene' : 'link'}
              options={[
                ['link', 'collegamento'],
                ['scene', 'scena']
              ]}
              onChange={(t) => onChange({ ...effect, target: { type: t, id: '' } })}
            />
            <Pick type={effect.target.type} value={effect.target.id} onChange={(id) => onChange({ ...effect, target: { ...effect.target, id } })} />
          </>
        )
      case 'setFlag':
        return (
          <>
            <Pick type="flag" value={effect.flagId} onChange={(flagId) => onChange({ ...effect, flagId })} />
            <span className="text-tx3">=</span>
            <Select className="w-[90px]" value={effect.value ? 'true' : 'false'} options={[['true', 'vero'], ['false', 'falso']]} onChange={(v) => onChange({ ...effect, value: v === 'true' })} />
          </>
        )
      case 'freeText':
        return <TextInput className="min-w-[min(100%,12rem)] flex-1" placeholder="Descrivi l'effetto" value={effect.text} onCommit={(text) => onChange({ ...effect, text })} />
    }
  })()
  return (
    <div className="flex items-start gap-1.5">
      <Zap size={13} className="mt-2 flex-none text-ac" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <Select className="w-[160px] max-w-full flex-none" value={effect.type} options={EFFECT_TYPES} onChange={(t) => onChange(defaultEffect(p, t))} />
        {body}
      </div>
      <IconButton icon={Trash2} size={13} className="mt-[3px]" title="Rimuovi effetto" onClick={onRemove} />
    </div>
  )
}

export function EffectList({ effects, onChange, emptyText = 'Nessun effetto.' }: { effects: Effect[]; onChange(e: Effect[]): void; emptyText?: string }) {
  const p = useProject()
  return (
    <div className="flex flex-col gap-1.5">
      {effects.length === 0 && <Empty>{emptyText}</Empty>}
      {effects.map((e, i) => (
        <EffectRow
          key={i}
          effect={e}
          onChange={(x) => onChange(effects.map((y, j) => (j === i ? x : y)))}
          onRemove={() => onChange(effects.filter((_, j) => j !== i))}
        />
      ))}
      <div>
        <AddButton onClick={() => onChange([...effects, defaultEffect(p, 'gainItem')])}>Effetto</AddButton>
      </div>
    </div>
  )
}

/** Riga compatta in sola lettura (sezione "Effetti all'ingresso" ecc.). */
export function EffectSummary({ effect }: { effect: Effect }) {
  const p = useProject()
  return (
    <span className="flex items-center gap-1.5">
      <Zap size={12} className="text-ac" />
      {describeEffect(p, effect)}
    </span>
  )
}

/** Prova di abilità: abilità + CD, esiti di successo e fallimento con destinazione ed effetti. */
export function SkillCheckEditor({
  check,
  onChange,
  targetType,
  lineOptions = []
}: {
  check: SkillCheck
  onChange(c: SkillCheck): void
  /** Scena (grafo) o battuta (dialogo); null = l'esito non sposta. */
  targetType: 'scene' | 'dialogLine' | null
  lineOptions?: { id: string; label: string }[]
}) {
  const p = useProject()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Combobox className="min-w-[8rem] flex-1" value={check.skillId} options={options(p, 'skill')} onChange={(skillId) => skillId && onChange({ ...check, skillId })} />
        <span className="font-mono text-[11px] text-tx3">CD</span>
        <NumberInput className="w-16" min={1} value={check.dc} onCommit={(dc) => onChange({ ...check, dc: dc ?? 10 })} />
      </div>
      {(['success', 'failure'] as const).map((k) => (
        <div key={k} className="flex flex-col gap-1.5 rounded-lg border border-line2 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-[86px] font-mono text-[10px] font-semibold tracking-[.08em] ${k === 'success' ? 'text-safe' : 'text-err'}`}>
              {k === 'success' ? 'RIUSCITA' : 'FALLIMENTO'}
            </span>
            {targetType && (
              <Combobox
                className="min-w-[8rem] flex-1"
                allowClear
                placeholder={targetType === 'scene' ? 'Destinazione predefinita' : 'Nessuna battuta (chiude)'}
                value={check[k].target?.id ?? null}
                options={targetType === 'scene' ? options(p, 'scene') : lineOptions}
                onChange={(id) => onChange({ ...check, [k]: { ...check[k], target: id ? { type: targetType, id } : null } })}
              />
            )}
          </div>
          <EffectList effects={check[k].effects} onChange={(effects) => onChange({ ...check, [k]: { ...check[k], effects } })} emptyText="Nessun effetto per questo esito." />
        </div>
      ))}
    </div>
  )
}
