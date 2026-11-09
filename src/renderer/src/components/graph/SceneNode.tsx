import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { CircleAlert, Dices, Flag, GitFork, Lock, MessagesSquare, OctagonX, Package, Play, Store, UserRound, Zap, type LucideIcon } from 'lucide-react'
import type { Ending, Scene, SceneLabel } from '@shared/model'
import { imageUrl } from '@shared/ipc'
import { readableOn } from '../../lib/labels'
import { LabelChip } from '../scene/SceneLook'
import { TagChip, cn } from '../ui/primitives'

export const SCENE_NODE_WIDTH = 200

export interface SceneNodeData extends Record<string, unknown> {
  scene: Scene
  imageName: string | null
  labels: SceneLabel[]
  isStart: boolean
  ending: Ending | null
  isShop: boolean
  exits: number
  dialogs: number
  conditions: number
  effects: number
  checks: number
  /** Sovrapposizioni calcolate dal canvas: validazione, ricerca/filtri, percorso decisivo. */
  errors?: number
  warnings?: number
  issueText?: string
  dim?: boolean
  hit?: boolean
  pathColor?: string | null
}

export type SceneFlowNode = Node<SceneNodeData, 'scene'>

function Metric({ icon: Icon, value, accent }: { icon: LucideIcon; value: number; accent?: boolean }) {
  if (value === 0) return null
  return (
    <span className={cn('flex items-center gap-[3px]', accent && 'text-ac')}>
      <Icon size={11} />
      {value}
    </span>
  )
}

/** Nodo scena 200px (§1 del README di handoff). */
export const SceneNode = memo(function SceneNode({ data, selected }: NodeProps<SceneFlowNode>) {
  const { scene, ending } = data
  const cover = scene.cover
  const full = cover?.size === 'full'
  const error = (data.errors ?? 0) > 0
  const startBadge = data.isStart ? (
    <span className="relative flex h-[18px] w-fit items-center gap-1 rounded-[4px] bg-ac px-1.5 font-mono text-[9.5px] leading-none font-bold tracking-[.06em] text-btntx">
      <Play size={9} fill="currentColor" />
      PARTENZA
    </span>
  ) : (
    <span />
  )
  const rings = [
    selected ? '0 0 0 4px var(--acbg)' : null,
    data.hit ? '0 0 0 2px var(--ac), 0 0 24px var(--acbg)' : null,
    data.pathColor && !selected ? `0 0 0 1.5px ${data.pathColor}` : null
  ].filter(Boolean)
  return (
    <div
      className={cn(
        'relative border border-line2 bg-raised transition-opacity duration-[120ms]',
        error ? 'rounded-[4px] border-err' : 'rounded-[10px]',
        selected && 'border-ac'
      )}
      title={data.issueText}
      style={{
        width: SCENE_NODE_WIDTH,
        opacity: data.dim ? 0.22 : 1,
        boxShadow: rings.join(', ') || undefined,
        ...(ending && !selected && !error ? { borderColor: ending.color, borderWidth: 1.5 } : {})
      }}
    >
      {error && (
        <span className="absolute -top-[9px] -right-[9px] z-[1] flex h-5 items-center gap-1 rounded-[4px] bg-err pr-[7px] pl-[5px] font-mono text-[10px] font-bold text-btntx shadow-[0_0_0_3px_var(--bg)]">
          <OctagonX size={11} />
          ERRORE
        </span>
      )}
      {!error && (data.warnings ?? 0) > 0 && !ending && (
        <span className="absolute -top-[9px] -right-[9px] z-[1] flex h-5 items-center gap-1 rounded-[10px] bg-warn pr-[7px] pl-[5px] font-mono text-[10px] font-bold text-btntx shadow-[0_0_0_3px_var(--bg)]">
          <CircleAlert size={11} />
          AVVISO
        </span>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {full && (
        <div className="absolute inset-0 overflow-hidden rounded-[9px]" style={{ background: cover.color ?? 'var(--sunken)' }}>
          {cover.imageId && (
            <>
              <img src={imageUrl(cover.imageId)} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </>
          )}
        </div>
      )}

      {!full && (
        <div
          className={cn('box-border flex h-14 items-end justify-between rounded-t-[9px] border-b border-line px-2 py-1.5', !cover && 'stripes')}
          style={cover ? { background: cover.color ?? 'var(--sunken)' } : undefined}
        >
          {(cover?.imageId ?? (cover ? null : scene.imageId)) && (
            <img src={imageUrl((cover?.imageId ?? scene.imageId)!)} alt="" className="absolute inset-x-0 top-0 h-14 w-full rounded-t-[9px] object-cover" draggable={false} />
          )}
          {startBadge}
        </div>
      )}

      {ending && !error && (
        <span
          className="absolute -top-[9px] -right-[9px] flex h-5 items-center gap-1 rounded-[4px] pr-[7px] pl-[5px] font-mono text-[10px] font-bold text-btntx shadow-[0_0_0_3px_var(--bg)]"
          style={{ background: ending.color }}
        >
          <Flag size={11} />
          FINALE
        </span>
      )}

      <div
        className={cn('relative flex flex-col gap-1.5 px-2.5 pt-[9px] pb-2.5', full && 'min-h-[104px] justify-end')}
        style={full ? { color: cover.imageId ? '#fff' : readableOn(cover.color ?? '#000') } : undefined}
      >
        {full && startBadge}
        <div className="flex flex-wrap gap-1">
          {!scene.tagHidden && (
            <span className={cn('rounded-[4px]', full && 'bg-raised')}>
              <TagChip tag={scene.tag} />
            </span>
          )}
          {data.labels.map((l) => (
            <LabelChip key={l.id} label={l} className={cn(full && 'shadow-[0_0_0_1px_#0006]')} />
          ))}
          {data.isShop && (
            <span className="inline-flex h-[18px] items-center gap-1 rounded-[4px] border border-line2 px-1.5 font-mono text-[9.5px] leading-none font-semibold tracking-[.06em] text-tx2">
              <Store size={9} />
              NEGOZIO
            </span>
          )}
          {ending && (
            <span
              className="inline-flex h-[18px] items-center rounded-[4px] px-1.5 font-mono text-[9.5px] leading-none font-semibold tracking-[.06em] uppercase"
              style={{ color: ending.color, background: `color-mix(in srgb, ${ending.color} 14%, transparent)` }}
            >
              {ending.label || 'Finale'}
            </span>
          )}
        </div>
        <div className="text-[13px] font-semibold">{scene.title}</div>
        {data.issueText && (error || (data.warnings ?? 0) > 0) && (
          <div className={cn('text-[11px] leading-snug', error ? 'text-err' : 'text-warn')}>{data.issueText}</div>
        )}
        <div className={cn('flex gap-2.5 font-mono text-[10.5px] font-medium', full ? 'opacity-80' : 'text-tx3')}>
          <Metric icon={UserRound} value={scene.npcs.length} />
          <Metric icon={MessagesSquare} value={data.dialogs} />
          <Metric icon={GitFork} value={data.exits} />
          <Metric icon={Package} value={scene.items.length} />
          <Metric icon={Lock} value={data.conditions} accent />
          <Metric icon={Zap} value={data.effects} />
          <Metric icon={Dices} value={data.checks} />
        </div>
      </div>
    </div>
  )
})
