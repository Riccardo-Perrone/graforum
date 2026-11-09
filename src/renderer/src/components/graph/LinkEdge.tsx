import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react'
import { Dices, Lock } from 'lucide-react'
import type { Link } from '@shared/model'
import { cn } from '../ui/primitives'

export interface LinkEdgeData extends Record<string, unknown> {
  link: Link
  /** Prove alternative già abbreviate, es. "FOR 15 / DES 14". */
  checkLabel: string | null
  conditionLabel: string | null
  /** Esiste anche il collegamento inverso: il tratto si scosta di lato. */
  parallel: boolean
  dim?: boolean
  pathColor?: string | null
}

export type LinkFlowEdge = Edge<LinkEdgeData, 'link'>

type Point = { x: number; y: number }

/** Punto in cui la retta centro→centro esce dal rettangolo del nodo ("floating edge"). */
function borderPoint(node: InternalNode, toward: Point): Point {
  const w = node.measured.width ?? 0
  const h = node.measured.height ?? 0
  const cx = node.internals.positionAbsolute.x + w / 2
  const cy = node.internals.positionAbsolute.y + h / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = Math.min(Math.abs(w / 2 / (dx || 1e-9)), Math.abs(h / 2 / (dy || 1e-9)))
  return { x: cx + dx * scale, y: cy + dy * scale }
}

const center = (node: InternalNode): Point => ({
  x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
  y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2
})

const GAP = 6
const PARALLEL_OFFSET = 24

/** Collegamento: tratto 1.5px, freccia sull'arrivo (doppia se bidirezionale), etichetta a pillola. */
export const LinkEdge = memo(function LinkEdge({ id, source, target, data, selected, markerEnd, markerStart }: EdgeProps<LinkFlowEdge>) {
  const from = useInternalNode(source)
  const to = useInternalNode(target)
  if (!from || !to || !data) return null

  const a = borderPoint(from, center(to))
  const b = borderPoint(to, center(from))
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  // La perpendicolare si inverte col verso: lo stesso scostamento separa andata e ritorno.
  const side = data.parallel ? PARALLEL_OFFSET : 0
  const ox = -uy * side
  const oy = ux * side
  const lead = data.link.bidirectional ? GAP : 0
  const start = { x: a.x + ux * lead + ox, y: a.y + uy * lead + oy }
  const end = { x: b.x - ux * GAP + ox, y: b.y - uy * GAP + oy }
  const path = `M${start.x},${start.y} L${end.x},${end.y}`
  // Con andata e ritorno le etichette stanno a un terzo del proprio tratto, così non si coprono.
  const t = data.parallel ? 0.33 : 0.5
  const mid = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
  const rich = Boolean(data.checkLabel || data.conditionLabel)

  return (
    <>
      {data.pathColor && <path d={path} fill="none" stroke={data.pathColor} strokeWidth={6} opacity={0.16} />}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={14}
        style={{
          ...(data.pathColor ? { stroke: data.pathColor, strokeWidth: 2 } : {}),
          ...(selected ? { stroke: 'var(--ac)' } : {}),
          opacity: data.dim ? 0.22 : 1
        }}
      />
      {(data.link.label || rich) && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'nodrag nopan pointer-events-auto absolute flex items-center gap-1.5 rounded-[4px] border border-line2 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-tx2',
              rich ? 'bg-raised' : 'bg-bg',
              selected && 'border-ac text-tx'
            )}
            style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`, opacity: data.dim ? 0.22 : 1 }}
          >
            {data.link.label}
            {data.conditionLabel && (
              <span className="flex items-center gap-1 rounded-[3px] bg-acbg px-[5px] py-px font-mono text-[10px] font-semibold text-ac">
                <Lock size={10} />
                {data.conditionLabel}
              </span>
            )}
            {data.checkLabel && (
              <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-tx">
                <Dices size={11} />
                {data.checkLabel}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
