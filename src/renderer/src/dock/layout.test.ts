import { describe, expect, it } from 'vitest'
import type { SerializedDockview } from 'dockview-react'
import { isUsableLayout, stripPopouts } from './layout'

const panel = (id: string, contentComponent = id) => ({ id, contentComponent, title: id })
const layout = (panels: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ grid: { root: { type: 'leaf', data: { views: [], id: '1' } }, height: 1, width: 1, orientation: 'HORIZONTAL' }, panels, ...extra }) as unknown

describe('isUsableLayout', () => {
  it('accetta un layout con il grafo e sole schede note', () => {
    expect(isUsableLayout(layout({ graph: panel('graph'), catalog: panel('catalog') }))).toBe(true)
  })

  it('rifiuta valori che non sono un layout', () => {
    for (const v of [null, undefined, 'x', 42, [], {}, { grid: {}, panels: [] }]) expect(isUsableLayout(v)).toBe(false)
  })

  it('rifiuta un layout senza la scheda del grafo', () => {
    expect(isUsableLayout(layout({ catalog: panel('catalog') }))).toBe(false)
  })

  it('rifiuta schede di componenti sconosciuti o con id incoerente', () => {
    expect(isUsableLayout(layout({ graph: panel('graph'), mappa: panel('mappa') }))).toBe(false)
    expect(isUsableLayout(layout({ graph: panel('graph'), catalog: panel('altro', 'catalog') }))).toBe(false)
  })
})

describe('stripPopouts', () => {
  it('toglie le finestre staccate e le loro schede, lasciando il resto', () => {
    const json = layout(
      { graph: panel('graph'), catalog: panel('catalog') },
      { popoutGroups: [{ data: { views: ['catalog'], id: '2' }, gridReferenceGroup: '1', position: null }] }
    ) as SerializedDockview
    const out = stripPopouts(json)
    expect(Object.keys(out.panels)).toEqual(['graph'])
    expect(out.popoutGroups).toEqual([])
  })

  it('non cambia un layout senza finestre staccate', () => {
    const json = layout({ graph: panel('graph') }) as SerializedDockview
    expect(stripPopouts(json)).toBe(json)
  })
})
