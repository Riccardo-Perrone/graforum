import { Trash2 } from 'lucide-react'
import type { CustomFieldDef } from '@shared/model'
import { apply, createEntity, options, useProject } from '../../lib/entities'
import { Combobox } from '../ui/Combobox'
import { AddButton, NumberInput, Select, TextArea, TextInput } from '../ui/form'
import { IconButton } from '../ui/primitives'
import { Empty } from '../ui/Sheet'

// Campi riusabili delle schede di catalogo.

export const ABILITIES = [
  ['str', 'FOR'],
  ['dex', 'DES'],
  ['con', 'COS'],
  ['int', 'INT'],
  ['wis', 'SAG'],
  ['cha', 'CAR']
] as const

export const modifier = (score: number) => {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : String(m)
}

/** Elenco di testi modificato come valori separati da virgola. */
export function ListInput({ value, onCommit, placeholder }: { value: string[]; onCommit(v: string[]): void; placeholder?: string }) {
  return (
    <TextInput
      value={value.join(', ')}
      placeholder={placeholder}
      onCommit={(v) =>
        onCommit(
          v
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        )
      }
    />
  )
}

/** Griglia chiave/valore: etichetta a sinistra, controllo a destra. */
export function KeyValue({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-tx3">{k}</span>
          <div className="min-w-0 [&_input]:w-full">{v}</div>
        </div>
      ))}
    </div>
  )
}

/** Righe nome + testo (tratti, incantesimi). */
export function NamedList({ items, onChange, noun }: { items: { name: string; text: string }[]; onChange(v: { name: string; text: string }[]): void; noun: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.length === 0 && <Empty>Nessun elemento.</Empty>}
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5 rounded-lg border border-line2 p-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <TextInput className="font-semibold" placeholder="Nome" value={it.name} onCommit={(name) => onChange(items.map((x, j) => (j === i ? { ...x, name } : x)))} />
            <TextArea rows={2} placeholder="Descrizione" value={it.text} onCommit={(text) => onChange(items.map((x, j) => (j === i ? { ...x, text } : x)))} />
          </div>
          <IconButton icon={Trash2} size={13} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <AddButton onClick={() => onChange([...items, { name: '', text: '' }])}>{noun}</AddButton>
      </div>
    </div>
  )
}

/** Righe nome + bonus (abilità, tiri salvezza). */
export function BonusList({ items, onChange, noun }: { items: { name: string; bonus: number }[]; onChange(v: { name: string; bonus: number }[]): void; noun: string }) {
  const p = useProject()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1 rounded-md border border-line2 py-0.5 pr-1 pl-2">
          <Combobox
            className="h-6 w-[130px] border-0 bg-transparent px-0"
            value={it.name}
            options={[...new Set([it.name, ...p.settings.skills.map((s) => s.name)])].map((n) => ({ id: n, label: n }))}
            onChange={(name) => name && onChange(items.map((x, j) => (j === i ? { ...x, name } : x)))}
          />
          <NumberInput className="h-6 w-12" value={it.bonus} onCommit={(b) => onChange(items.map((x, j) => (j === i ? { ...x, bonus: b ?? 0 } : x)))} />
          <IconButton icon={Trash2} size={12} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </span>
      ))}
      <AddButton onClick={() => onChange([...items, { name: p.settings.skills[6]?.name ?? 'Abilità', bonus: 0 }])}>{noun}</AddButton>
    </div>
  )
}

/** Oggetti + quantità (bottino, ricompense). */
export function ItemQtyList({ items, onChange }: { items: { itemId: string; quantity: number }[]; onChange(v: { itemId: string; quantity: number }[]): void }) {
  const p = useProject()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((r, i) => (
        <span key={i} className="flex items-center gap-1">
          <Combobox className="w-[180px]" value={r.itemId} options={options(p, 'item')} onCreate={(n) => createEntity('item', n)} onChange={(id) => id && onChange(items.map((x, j) => (j === i ? { ...x, itemId: id } : x)))} />
          <NumberInput className="w-14" min={1} value={r.quantity} onCommit={(q) => onChange(items.map((x, j) => (j === i ? { ...x, quantity: q ?? 1 } : x)))} />
          <IconButton icon={Trash2} size={12} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </span>
      ))}
      <AddButton
        onClick={() => {
          const itemId = p.items[0]?.id ?? createEntity('item', 'Nuovo oggetto')!
          onChange([...items, { itemId, quantity: 1 }])
        }}
      >
        Oggetto
      </AddButton>
    </div>
  )
}

/** Campi custom definiti in Impostazioni per questo tipo di entità. */
export function CustomFields({
  appliesTo,
  values,
  onChange
}: {
  appliesTo: CustomFieldDef['appliesTo']
  values: { fieldId: string; value: string | number | boolean | null }[]
  onChange(v: { fieldId: string; value: string | number | boolean | null }[]): void
}) {
  const p = useProject()
  const defs = p.settings.customFields.filter((f) => f.appliesTo === appliesTo)
  if (defs.length === 0) return <Empty>Nessun campo custom. Si definiscono in Impostazioni › Campi custom.</Empty>
  const get = (id: string) => values.find((v) => v.fieldId === id)?.value ?? null
  const set = (id: string, value: string | number | boolean | null) => onChange([...values.filter((v) => v.fieldId !== id), { fieldId: id, value }])
  return (
    <div className="overflow-hidden rounded-lg border border-line2">
      {defs.map((f) => (
        <div key={f.id} className="grid grid-cols-[180px_1fr] items-center gap-3 border-b border-line px-3 py-1.5 last:border-b-0">
          <span className="text-tx2">{f.name}</span>
          {f.kind === 'number' ? (
            <NumberInput allowNull value={typeof get(f.id) === 'number' ? (get(f.id) as number) : null} onCommit={(v) => set(f.id, v)} />
          ) : f.kind === 'boolean' ? (
            <Select value={get(f.id) ? 'true' : 'false'} options={[['true', 'Sì'], ['false', 'No']]} onChange={(v) => set(f.id, v === 'true')} />
          ) : f.kind === 'choice' ? (
            <Select value={String(get(f.id) ?? '')} options={[['', '—'] as const, ...f.options.map((o) => [o, o] as const)]} onChange={(v) => set(f.id, v || null)} />
          ) : (
            <TextInput value={String(get(f.id) ?? '')} onCommit={(v) => set(f.id, v)} />
          )}
        </div>
      ))}
    </div>
  )
}

export function useCatalogUpdate() {
  return apply
}
