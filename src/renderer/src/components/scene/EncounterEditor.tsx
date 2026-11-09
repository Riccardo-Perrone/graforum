import { Trash2 } from 'lucide-react'
import type { Encounter } from '@shared/model'
import { apply, createEntity, options, useProject } from '../../lib/entities'
import { EffectList } from '../logic/EffectEditor'
import { Combobox } from '../ui/Combobox'
import { AddButton, Field, NumberInput, Segmented, TextInput } from '../ui/form'
import { IconButton } from '../ui/primitives'

const OUTCOMES = [
  ['win', 'VINTO', 'text-safe'],
  ['flee', 'FUGA', 'text-warn'],
  ['defeat', 'SCONFITTA', 'text-err']
] as const

/** Incontro di combattimento: enemy × quantità, unico/ripetibile, ricompense, tre esiti con destinazione. */
export function EncounterEditor({ encounter }: { encounter: Encounter }) {
  const p = useProject()
  const update = (label: string, recipe: (e: Encounter) => void, mergeKey?: string) =>
    apply(label, (d) => recipe(d.encounters.find((x) => x.id === encounter.id)!), mergeKey)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warn/40 bg-warnbg/40 p-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
        <Field label="Nome">
          <TextInput value={encounter.name} onCommit={(name) => update('Rinomina incontro', (e) => void (e.name = name))} />
        </Field>
        <Field label="Natura">
          <Segmented
            value={encounter.nature}
            options={[
              ['unique', 'Unico'],
              ['repeatable', 'Ripetibile']
            ]}
            onChange={(nature) => update('Natura incontro', (e) => void (e.nature = nature))}
          />
        </Field>
      </div>
      <Field label="Enemy">
        <div className="flex flex-col gap-1.5">
          {encounter.enemies.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <NumberInput className="w-16" min={1} value={row.quantity} onCommit={(q) => update('Quantità enemy', (e) => void (e.enemies[i]!.quantity = q ?? 1))} />
              <span className="text-tx3">×</span>
              <Combobox
                className="flex-1"
                value={row.enemyId}
                options={options(p, 'enemy')}
                onChange={(id) => id && update('Cambia enemy', (e) => void (e.enemies[i]!.enemyId = id))}
                onCreate={(name) => createEntity('enemy', name)}
              />
              <IconButton icon={Trash2} size={13} onClick={() => update('Rimuovi enemy', (e) => void e.enemies.splice(i, 1))} />
            </div>
          ))}
          <div>
            <AddButton
              onClick={() => {
                const enemyId = p.enemies[0]?.id ?? createEntity('enemy', 'Nuovo enemy')!
                update('Aggiungi enemy', (e) => void e.enemies.push({ enemyId, quantity: 1 }))
              }}
            >
              Enemy
            </AddButton>
          </div>
        </div>
      </Field>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
        <Field label="PE (XP)">
          <NumberInput min={0} value={encounter.rewards.xp} onCommit={(xp) => update('XP incontro', (e) => void (e.rewards.xp = xp ?? 0))} />
        </Field>
        <Field label="Oggetti ricompensa">
          <div className="flex flex-wrap items-center gap-1.5">
            {encounter.rewards.items.map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <Combobox className="w-[170px] max-w-full" value={r.itemId} options={options(p, 'item')} onChange={(id) => id && update('Ricompensa', (e) => void (e.rewards.items[i]!.itemId = id))} />
                <NumberInput className="w-14" min={1} value={r.quantity} onCommit={(q) => update('Ricompensa', (e) => void (e.rewards.items[i]!.quantity = q ?? 1))} />
                <IconButton icon={Trash2} size={12} onClick={() => update('Ricompensa', (e) => void e.rewards.items.splice(i, 1))} />
              </span>
            ))}
            <AddButton onClick={() => p.items[0] && update('Ricompensa', (e) => void e.rewards.items.push({ itemId: p.items[0]!.id, quantity: 1 }))}>Oggetto</AddButton>
          </div>
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[11.5px] text-tx3">Esiti: ognuno può portare a una scena diversa</span>
        {OUTCOMES.map(([k, label, color]) => (
          <div key={k} className="flex flex-col gap-1.5 rounded-lg border border-line2 bg-panel p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`w-[80px] font-mono text-[10px] font-semibold tracking-[.08em] ${color}`}>{label}</span>
              <Combobox
                className="min-w-[8rem] flex-1"
                allowClear
                placeholder="Resta nella scena"
                value={encounter.outcomes[k].target?.id ?? null}
                options={options(p, 'scene')}
                onChange={(id) => update('Destinazione esito', (e) => void (e.outcomes[k].target = id ? { type: 'scene', id } : null))}
              />
            </div>
            <EffectList effects={encounter.outcomes[k].effects} onChange={(fx) => update('Effetti esito', (e) => void (e.outcomes[k].effects = fx))} emptyText="Nessun effetto." />
          </div>
        ))}
      </div>
    </div>
  )
}
