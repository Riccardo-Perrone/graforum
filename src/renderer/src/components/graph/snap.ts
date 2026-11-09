// Aggancio dei nodi in stile Figma: il riquadro trascinato si allinea al bordo superiore/inferiore,
// sinistro/destro o al centro degli altri nodi entro una piccola soglia.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Linea guida da disegnare nello spazio del grafo. */
export interface Guide {
  axis: 'x' | 'y'
  pos: number
  from: number
  to: number
}

/** Distanza (in pixel dello schermo) entro cui scatta l'aggancio. */
export const SNAP_DISTANCE = 6

const anchors = (start: number, size: number) => [start, start + size / 2, start + size]

/** Scostamento minimo che porta un'ancora del riquadro su un'ancora di un altro, entro la soglia. */
function bestDelta(mine: number[], theirs: number[], threshold: number): number | null {
  let best: number | null = null
  for (const a of mine) for (const b of theirs) if (Math.abs(b - a) <= threshold && (best === null || Math.abs(b - a) < Math.abs(best))) best = b - a
  return best
}

export function computeSnap(moving: Box, others: Box[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  let dx = 0
  let dy = 0
  const xs = others.flatMap((o) => anchors(o.x, o.w))
  const ys = others.flatMap((o) => anchors(o.y, o.h))
  dx = bestDelta(anchors(moving.x, moving.w), xs, threshold) ?? 0
  dy = bestDelta(anchors(moving.y, moving.h), ys, threshold) ?? 0

  const m: Box = { ...moving, x: moving.x + dx, y: moving.y + dy }
  const guides: Guide[] = []
  const eps = 0.5
  for (const o of others) {
    for (const a of anchors(m.x, m.w))
      if (anchors(o.x, o.w).some((b) => Math.abs(a - b) < eps)) guides.push({ axis: 'x', pos: a, from: Math.min(m.y, o.y), to: Math.max(m.y + m.h, o.y + o.h) })
    for (const a of anchors(m.y, m.h))
      if (anchors(o.y, o.h).some((b) => Math.abs(a - b) < eps)) guides.push({ axis: 'y', pos: a, from: Math.min(m.x, o.x), to: Math.max(m.x + m.w, o.x + o.w) })
  }
  return { dx, dy, guides }
}
