import { describe, expect, it } from 'vitest'
import { computeSnap } from './snap'

const box = (x: number, y: number, w = 100, h = 50) => ({ x, y, w, h })

describe('aggancio dei nodi', () => {
  it('allinea il bordo sinistro entro la soglia e disegna la guida', () => {
    const r = computeSnap(box(103, 300), [box(100, 0)], 6)
    expect(r.dx).toBe(-3)
    expect(r.dy).toBe(0)
    expect(r.guides.some((g) => g.axis === 'x' && g.pos === 100)).toBe(true)
  })

  it('allinea i centri e sceglie lo scostamento più piccolo', () => {
    // Ancore verticali dell'altro nodo: 0, 25, 50. Le nostre (y 12, alto 30): 12, 27, 42 → il centro dista 2.
    const r = computeSnap(box(500, 12, 100, 30), [box(0, 0, 100, 50)], 6)
    expect(r.dy).toBe(-2)
  })

  it('oltre la soglia non aggancia', () => {
    expect(computeSnap(box(110, 300), [box(100, 0)], 6)).toEqual({ dx: 0, dy: 0, guides: [] })
  })

  it('senza altri nodi non si muove', () => {
    expect(computeSnap(box(3, 3), [], 6)).toEqual({ dx: 0, dy: 0, guides: [] })
  })
})
