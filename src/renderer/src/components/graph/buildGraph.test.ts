import { describe, expect, it } from 'vitest'
import { sampleProject } from '@shared/sample/locanda-del-corvo'
import { buildGraph, sceneTopLeft, SCENE_NODE_HEIGHT } from './buildGraph'
import { SCENE_NODE_WIDTH } from './SceneNode'

const ids = (nodes: { id: string; type?: string }[], type: string) => nodes.filter((n) => n.type === type).map((n) => n.id).sort()

describe('costruzione del grafo', () => {
  it('disegna ogni scena, ogni gruppo aperto e un arco per collegamento', () => {
    const p = sampleProject()
    const g = buildGraph(p)
    expect(ids(g.nodes, 'scene')).toEqual(p.scenes.map((s) => s.id).sort())
    expect(ids(g.nodes, 'sceneGroup')).toEqual(['grp_brumavalle', 'grp_locanda'])
    expect(g.edges).toHaveLength(p.links.length)
  })

  it('il gruppo esterno contiene il sottogruppo e sta sotto di esso', () => {
    const g = buildGraph(sampleProject())
    const outer = g.nodes.find((n) => n.id === 'grp_brumavalle')!
    const inner = g.nodes.find((n) => n.id === 'grp_locanda')!
    if (outer.type !== 'sceneGroup' || inner.type !== 'sceneGroup') throw new Error('tipo inatteso')
    expect(inner.position.x).toBeGreaterThan(outer.position.x)
    expect(inner.position.x + inner.data.width).toBeLessThan(outer.position.x + outer.data.width)
    expect(inner.zIndex!).toBeLessThan(outer.zIndex!)
  })

  it('un gruppo collassato diventa una carta e nasconde scene e sottogruppi', () => {
    const p = sampleProject()
    p.groups.find((x) => x.id === 'grp_brumavalle')!.collapsed = true
    const g = buildGraph(p)
    expect(ids(g.nodes, 'collapsedGroup')).toEqual(['grp_brumavalle'])
    expect(ids(g.nodes, 'sceneGroup')).toEqual([])
    const inside = new Set(p.scenes.filter((s) => s.groupId === 'grp_brumavalle' || s.groupId === 'grp_locanda').map((s) => s.id))
    expect(ids(g.nodes, 'scene').some((id) => inside.has(id))).toBe(false)
    // Gli archi verso le scene nascoste partono dalla carta; quelli interni spariscono.
    expect(g.edges.every((e) => !inside.has(e.source) && !inside.has(e.target))).toBe(true)
    expect(g.edges.some((e) => e.source === 'grp_brumavalle')).toBe(true)
  })

  it('collassare anche il sottogruppo mostra solo la carta più esterna', () => {
    const p = sampleProject()
    for (const grp of p.groups) grp.collapsed = true
    expect(ids(buildGraph(p).nodes, 'collapsedGroup')).toEqual(['grp_brumavalle'])
  })

  it('sceneTopLeft centra la scena nel punto dato', () => {
    expect(sceneTopLeft({ x: 500, y: 300 })).toEqual({ x: 500 - SCENE_NODE_WIDTH / 2, y: 300 - SCENE_NODE_HEIGHT / 2 })
  })
})
