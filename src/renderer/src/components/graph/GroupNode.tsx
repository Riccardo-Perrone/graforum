import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Group, SceneTag } from '@shared/model'
import { apply } from '../../lib/entities'
import { dockBridge } from '../../dock/bridge'
import { useUiStore } from '../../store/ui'
import { TAG_META, cn } from '../ui/primitives'

export interface GroupNodeData extends Record<string, unknown> {
  group: Group
  sceneCount: number
  nested: boolean
  width: number
  height: number
  dim?: boolean
  /** Bersaglio dell'aggiunta per trascinamento: le scene trattenute qui verranno inserite nel gruppo. */
  drop?: boolean
  /** Tutte le scene del gruppo (anche dei sottogruppi) sono selezionate: il gruppo conta come selezionato. */
  groupSelected?: boolean
}

export type GroupFlowNode = Node<GroupNodeData, 'sceneGroup'>

export interface CollapsedGroupData extends Record<string, unknown> {
  group: Group
  sceneCount: number
  tags: Record<SceneTag, number>
  exits: number
  dim?: boolean
}

export type CollapsedGroupFlowNode = Node<CollapsedGroupData, 'collapsedGroup'>

const toggle = (group: Group) =>
  apply(group.collapsed ? 'Espandi gruppo' : 'Collassa gruppo', (d) => {
    const g = d.groups.find((x) => x.id === group.id)
    if (g) g.collapsed = !g.collapsed
  })

/** `handle`: l'etichetta è la maniglia per trascinare l'intero gruppo (gruppo aperto). */
function GroupLabel({ group, sceneCount, handle }: { group: Group; sceneCount: number; handle?: boolean }) {
  const Chevron = group.collapsed ? ChevronRight : ChevronDown
  return (
    <div className={cn('flex items-center gap-2 rounded-md border border-grpln bg-bg py-[3px] pr-[9px] pl-1.5 text-xs', handle ? 'group-handle cursor-grab' : 'nodrag')}>
      <button type="button" title={group.collapsed ? 'Espandi' : 'Collassa'} onClick={() => toggle(group)} className="cursor-pointer text-tx3 hover:text-tx">
        <Chevron size={13} />
      </button>
      <button
        type="button"
        className="group/name flex cursor-pointer items-center gap-2 hover:underline"
        onClick={() => {
          // Il gruppo si legge nella scheda del dock (che si apre se era chiusa).
          useUiStore.getState().setSelectedGroup(group.id)
          dockBridge.openPanel?.('inspector')
        }}
        title="Apri il gruppo"
      >
        <span className="font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">GRUPPO</span>
        <span className="font-semibold" style={group.color ? { color: group.color } : undefined}>
          {group.name}
        </span>
        <span className="font-mono text-[10.5px] text-tx3">
          {sceneCount} {sceneCount === 1 ? 'scena' : 'scene'}
        </span>
      </button>
    </div>
  )
}

/** Area del gruppo: bordo grpln, raggio 14 (12 se annidato), etichetta a cavallo del bordo. */
export const GroupNode = memo(function GroupNode({ data }: NodeProps<GroupFlowNode>) {
  // Selezionato: fondo appena tinto dell'accento e bordo accento attenuato (il pieno resta per il rilascio).
  const background = data.drop ? 'var(--acbg)' : data.groupSelected ? 'color-mix(in srgb, var(--ac) 9%, var(--grp))' : 'var(--grp)'
  const borderColor = data.drop ? 'var(--ac)' : data.groupSelected ? 'color-mix(in srgb, var(--ac) 60%, transparent)' : (data.group.color ?? undefined)
  return (
    <div
      className="pointer-events-none relative border border-grpln"
      data-group-selected={data.groupSelected ? '' : undefined}
      style={{
        width: data.width,
        height: data.height,
        borderRadius: data.nested ? 12 : 14,
        background,
        borderColor,
        opacity: data.dim ? 0.22 : 1
      }}
    >
      <div className="pointer-events-auto absolute -top-[11px] left-3">
        <GroupLabel group={data.group} sceneCount={data.sceneCount} handle />
      </div>
      {data.drop && <span className="absolute right-3 -bottom-[11px] rounded-md bg-ac px-2 py-[2px] font-mono text-[10px] font-semibold text-btntx">RILASCIA PER AGGIUNGERE AL GRUPPO</span>}
    </div>
  )
})

/** Gruppo collassato: carta impilata con distribuzione dei tag e conteggi. */
export const CollapsedGroupNode = memo(function CollapsedGroupNode({ data, selected }: NodeProps<CollapsedGroupFlowNode>) {
  const total = Math.max(1, data.sceneCount)
  return (
    <div className="relative w-[200px]" style={{ opacity: data.dim ? 0.22 : 1 }}>
      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-[10px] border border-grpln bg-raised" />
      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-[10px] border border-grpln bg-raised" />
      <div className={`relative flex flex-col gap-2 rounded-[10px] border bg-raised p-2.5 ${selected ? 'border-ac' : 'border-grpln'}`}>
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        <GroupLabel group={data.group} sceneCount={data.sceneCount} />
        <div className="flex h-1.5 overflow-hidden rounded-full bg-sunken">
          {(['neutral', 'safe', 'warning'] as const).map((t) => (
            <span key={t} style={{ width: `${(data.tags[t] / total) * 100}%`, background: `var(--${t === 'neutral' ? 'neu' : t === 'safe' ? 'safe' : 'warn'})` }} />
          ))}
        </div>
        <div className="flex gap-2.5 font-mono text-[10.5px] text-tx3">
          {(['neutral', 'safe', 'warning'] as const).map((t) => {
            const Icon = TAG_META[t].icon
            return data.tags[t] ? (
              <span key={t} className={`flex items-center gap-1 ${TAG_META[t].fg}`}>
                <Icon size={10} />
                {data.tags[t]}
              </span>
            ) : null
          })}
          <span className="ml-auto">{data.exits} uscite</span>
        </div>
      </div>
    </div>
  )
})
