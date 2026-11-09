import { CornerDownRight, Dices, Plus, Trash2 } from 'lucide-react'
import type { Condition, ConditionGroup, ConditionLeaf, EntityType, Project } from '@shared/model'
import { CREATABLE, createEntity, options, useProject } from '../../lib/entities'
import { Combobox } from '../ui/Combobox'
import { NumberInput, Segmented, Select, TextInput } from '../ui/form'
import { IconButton, cn } from '../ui/primitives'

// Costruttore di condizioni con gruppi E/O annidati (6b).

export const LEAF_TYPES = [
  ['hasItem', 'Oggetto'],
  ['questState', 'Quest'],
  ['dialogCompleted', 'Dialogo completato'],
  ['dialogChoice', 'Scelta di dialogo'],
  ['talkedTo', 'Ha parlato con'],
  ['encounterOutcome', 'Incontro'],
  ['flag', 'Flag'],
  ['checkPassed', 'Prova superata'],
  ['sceneVisited', 'Scena visitata'],
  ['customType', 'Tipo custom'],
  ['freeText', 'Personalizzata']
] as const

type LeafType = ConditionLeaf['type']

export function defaultLeaf(p: Project, type: LeafType): ConditionLeaf {
  switch (type) {
    case 'hasItem':
      return { type, itemId: p.items[0]?.id ?? '', quantity: 1 }
    case 'questState':
      return { type, questId: p.quests[0]?.id ?? '', stepId: null, state: 'completed' }
    case 'dialogCompleted':
      return { type, dialogId: p.dialogs[0]?.id ?? '' }
    case 'dialogChoice': {
      const d = p.dialogs[0]
      return { type, dialogId: d?.id ?? '', choiceId: d?.lines.flatMap((l) => l.choices)[0]?.id ?? '' }
    }
    case 'talkedTo':
      return { type, npcId: p.npcs[0]?.id ?? '' }
    case 'encounterOutcome':
      return { type, encounterId: p.encounters[0]?.id ?? '', outcome: 'win' }
    case 'flag':
      return { type, flagId: p.flags[0]?.id ?? '', value: true }
    case 'checkPassed':
      return { type, checkIds: [] }
    case 'sceneVisited':
      return { type, sceneId: p.scenes[0]?.id ?? '' }
    case 'customType':
      return { type, conditionTypeId: p.settings.conditionTypes[0]?.id ?? '', values: {} }
    case 'freeText':
      return { type, text: '', ref: null }
  }
}

function EntityPick({ type, value, onChange, filter }: { type: EntityType; value: string; onChange(id: string): void; filter?: (id: string) => boolean }) {
  const p = useProject()
  return (
    <Combobox
      className="min-w-[180px] flex-1"
      value={value || null}
      options={options(p, type, filter)}
      onChange={(id) => id && onChange(id)}
      onCreate={CREATABLE.includes(type) ? (name) => createEntity(type, name) : undefined}
    />
  )
}

/** Tutte le prove di abilità del progetto, per la condizione "prova superata". */
function allChecks(p: Project) {
  return [
    ...p.links.flatMap((l) => l.checks.map((c) => ({ c, where: `${p.scenes.find((s) => s.id === l.fromSceneId)?.title ?? ''} → ${l.label}` }))),
    ...p.scenes.flatMap((s) => [
      ...s.items.flatMap((i) => i.checks.map((c) => ({ c, where: `${s.title} · ${p.items.find((x) => x.id === i.itemId)?.name ?? ''}` }))),
      ...(s.entryCheck ? [{ c: s.entryCheck, where: `${s.title} · ingresso` }] : [])
    ]),
    ...p.dialogs.flatMap((d) => d.lines.flatMap((l) => l.choices.flatMap((ch) => (ch.check ? [{ c: ch.check, where: `${d.title} · ${ch.text.slice(0, 24)}` }] : []))))
  ]
}

export function LeafEditor({ leaf, onChange, extraChecks = [] }: { leaf: ConditionLeaf; onChange(l: ConditionLeaf): void; extraChecks?: { id: string; label: string }[] }) {
  const p = useProject()
  const typeSelect = (
    <Select className="w-[150px] flex-none" value={leaf.type} options={LEAF_TYPES} onChange={(t) => onChange(defaultLeaf(p, t))} />
  )
  const body = (() => {
    switch (leaf.type) {
      case 'hasItem':
        return (
          <>
            <EntityPick type="item" value={leaf.itemId} onChange={(itemId) => onChange({ ...leaf, itemId })} />
            <span className="text-tx3">almeno</span>
            <NumberInput className="w-16" min={1} value={leaf.quantity} onCommit={(q) => onChange({ ...leaf, quantity: q ?? 1 })} />
          </>
        )
      case 'questState': {
        const quest = p.quests.find((q) => q.id === leaf.questId)
        return (
          <>
            <EntityPick type="quest" value={leaf.questId} onChange={(questId) => onChange({ ...leaf, questId, stepId: null })} />
            <Select
              className="w-[150px]"
              value={leaf.stepId ?? ''}
              options={[['', 'quest intera'], ...(quest?.steps.map((s, i) => [s.id, `step ${i + 1} · ${s.title}`] as const) ?? [])]}
              onChange={(v) => onChange({ ...leaf, stepId: v || null })}
            />
            <Select
              className="w-[120px]"
              value={leaf.state}
              options={[
                ['notStarted', 'non iniziata'],
                ['inProgress', 'in corso'],
                ['completed', 'completata']
              ]}
              onChange={(state) => onChange({ ...leaf, state })}
            />
          </>
        )
      }
      case 'dialogCompleted':
        return <EntityPick type="dialog" value={leaf.dialogId} onChange={(dialogId) => onChange({ ...leaf, dialogId })} />
      case 'dialogChoice': {
        const d = p.dialogs.find((x) => x.id === leaf.dialogId)
        const choices = d?.lines.flatMap((l) => l.choices) ?? []
        return (
          <>
            <EntityPick type="dialog" value={leaf.dialogId} onChange={(dialogId) => onChange({ ...leaf, dialogId, choiceId: '' })} />
            <Combobox
              className="min-w-[180px] flex-1"
              value={leaf.choiceId || null}
              placeholder="Scelta…"
              options={choices.map((c) => ({ id: c.id, label: c.text || '(senza testo)' }))}
              onChange={(choiceId) => choiceId && onChange({ ...leaf, choiceId })}
            />
          </>
        )
      }
      case 'talkedTo':
        return <EntityPick type="npc" value={leaf.npcId} onChange={(npcId) => onChange({ ...leaf, npcId })} />
      case 'encounterOutcome':
        return (
          <>
            <EntityPick type="encounter" value={leaf.encounterId} onChange={(encounterId) => onChange({ ...leaf, encounterId })} />
            <Select
              className="w-[120px]"
              value={leaf.outcome}
              options={[
                ['win', 'vinto'],
                ['flee', 'fuga'],
                ['defeat', 'sconfitta'],
                ['any', 'qualsiasi esito']
              ]}
              onChange={(outcome) => onChange({ ...leaf, outcome })}
            />
          </>
        )
      case 'flag':
        return (
          <>
            <EntityPick type="flag" value={leaf.flagId} onChange={(flagId) => onChange({ ...leaf, flagId })} />
            <span className="text-tx3">=</span>
            <Select className="w-[90px]" value={leaf.value ? 'true' : 'false'} options={[['true', 'vero'], ['false', 'falso']]} onChange={(v) => onChange({ ...leaf, value: v === 'true' })} />
          </>
        )
      case 'checkPassed': {
        const checks = [...extraChecks, ...allChecks(p).map(({ c, where }) => ({ id: c.id, label: `${p.settings.skills.find((s) => s.id === c.skillId)?.name ?? '?'} CD ${c.dc} · ${where}` }))]
        const unique = checks.filter((c, i) => checks.findIndex((x) => x.id === c.id) === i)
        return (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {leaf.checkIds.map((id) => (
              <span key={id} className="flex items-center gap-1 rounded-[4px] border border-line2 px-1.5 py-0.5 font-mono text-[10.5px]">
                <Dices size={11} />
                {unique.find((c) => c.id === id)?.label.split(' · ')[0] ?? '(prova eliminata)'}
                <button type="button" className="text-tx3 hover:text-err" onClick={() => onChange({ ...leaf, checkIds: leaf.checkIds.filter((x) => x !== id) })}>
                  ×
                </button>
              </span>
            ))}
            <Combobox
              className="min-w-[160px] flex-1"
              value={null}
              placeholder="Aggiungi prova alternativa…"
              options={unique.filter((c) => !leaf.checkIds.includes(c.id)).map((c) => ({ id: c.id, label: c.label }))}
              onChange={(id) => id && onChange({ ...leaf, checkIds: [...leaf.checkIds, id] })}
            />
          </div>
        )
      }
      case 'sceneVisited':
        return <EntityPick type="scene" value={leaf.sceneId} onChange={(sceneId) => onChange({ ...leaf, sceneId })} />
      case 'customType': {
        const t = p.settings.conditionTypes.find((x) => x.id === leaf.conditionTypeId)
        return (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <EntityPick type="conditionType" value={leaf.conditionTypeId} onChange={(conditionTypeId) => onChange({ ...leaf, conditionTypeId, values: {} })} />
            {t?.params.map((param) => {
              const v = leaf.values[param.key] ?? null
              const set = (val: (typeof leaf.values)[string]) => onChange({ ...leaf, values: { ...leaf.values, [param.key]: val } })
              if (param.kind === 'boolean')
                return <Select key={param.key} className="w-[110px]" value={v ? 'true' : 'false'} options={[['true', `${param.label}: sì`], ['false', `${param.label}: no`]]} onChange={(x) => set(x === 'true')} />
              if (param.kind === 'number') return <NumberInput key={param.key} className="w-20" value={typeof v === 'number' ? v : 0} onCommit={(x) => set(x ?? 0)} />
              if (param.kind === 'entity' && param.entityType)
                return (
                  <EntityPick
                    key={param.key}
                    type={param.entityType}
                    value={v && typeof v === 'object' ? v.id : ''}
                    onChange={(id) => set({ type: param.entityType!, id })}
                  />
                )
              return <TextInput key={param.key} className="w-[140px]" placeholder={param.label} value={typeof v === 'string' ? v : ''} onCommit={(x) => set(x)} />
            })}
            {!t && <span className="text-tx3">Definisci i tipi in Impostazioni › Tipi di condizione</span>}
          </div>
        )
      }
      case 'freeText':
        return <TextInput className="min-w-[200px] flex-1" placeholder="Descrivi la condizione" value={leaf.text} onCommit={(text) => onChange({ ...leaf, text })} />
    }
  })()
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {typeSelect}
      {body}
    </div>
  )
}

const asGroup = (c: Condition | null): ConditionGroup => (c?.type === 'group' ? c : { type: 'group', op: 'and', children: c ? [c] : [] })

/** Editor ricorsivo: il livello più alto è sempre un gruppo E/O. */
export function ConditionTree({
  value,
  onChange,
  depth = 0,
  onRemove
}: {
  value: Condition | null
  onChange(c: Condition | null): void
  depth?: number
  onRemove?(): void
}) {
  const p = useProject()
  const group = asGroup(value)
  const setGroup = (g: ConditionGroup) => onChange(g.children.length === 0 && depth === 0 ? null : g)
  const setChild = (i: number, c: Condition | null) => {
    const children = [...group.children]
    if (c === null) children.splice(i, 1)
    else children[i] = c
    setGroup({ ...group, children })
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-line2 p-2.5', depth > 0 ? 'border-dashed bg-transparent' : 'bg-sunken/40')}>
      <div className="flex items-center gap-2">
        <Segmented
          className="w-[86px]"
          value={group.op}
          options={[
            ['and', 'E'],
            ['or', 'O']
          ]}
          onChange={(op) => setGroup({ ...group, op })}
        />
        <span className="flex-1 text-[11.5px] text-tx3">
          {group.op === 'and' ? 'tutte le condizioni devono essere vere' : 'basta una condizione vera'}
        </span>
        {onRemove && <IconButton icon={Trash2} size={13} title="Rimuovi gruppo" onClick={onRemove} />}
      </div>
      {group.children.map((child, i) =>
        child.type === 'group' ? (
          <div key={i} className="flex gap-1.5 pl-2">
            <CornerDownRight size={14} className="mt-2 flex-none text-tx3" />
            <div className="min-w-0 flex-1">
              <ConditionTree value={child} depth={depth + 1} onChange={(c) => setChild(i, c ?? { type: 'group', op: 'and', children: [] })} onRemove={() => setChild(i, null)} />
            </div>
          </div>
        ) : (
          <div key={i} className="flex items-start gap-1.5">
            <LeafEditor leaf={child} onChange={(l) => setChild(i, l)} />
            <IconButton icon={Trash2} size={13} className="mt-[3px]" title="Rimuovi condizione" onClick={() => setChild(i, null)} />
          </div>
        )
      )}
      <div className="flex gap-1 text-[11.5px]">
        <button type="button" className="flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-tx2 hover:bg-hover hover:text-tx" onClick={() => setGroup({ ...group, children: [...group.children, defaultLeaf(p, 'hasItem')] })}>
          <Plus size={12} />
          Condizione
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-tx2 hover:bg-hover hover:text-tx"
          onClick={() => setGroup({ ...group, children: [...group.children, { type: 'group', op: group.op === 'and' ? 'or' : 'and', children: [defaultLeaf(p, 'hasItem')] }] })}
        >
          <Plus size={12} />
          Gruppo E/O
        </button>
        <button type="button" className="flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-tx2 hover:bg-hover hover:text-tx" onClick={() => setGroup({ ...group, children: [...group.children, defaultLeaf(p, 'checkPassed')] })}>
          <Dices size={12} />
          Prova di abilità
        </button>
      </div>
    </div>
  )
}
