import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { blockingIssues, exportHtml, exportJson, importJson, scopeProject } from './exporter'

const p = sampleProject()

describe('esportazione', () => {
  it('l’ambito gruppo tiene solo le sue scene e il catalogo che usano', () => {
    const s = scopeProject(p, { kind: 'group', groupId: 'grp_locanda' })
    expect(s.scenes.map((x) => x.id).sort()).toEqual(['scn_camera3', 'scn_cantina', 'scn_sala', 'scn_tesoro'])
    expect(s.links.every((l) => s.scenes.some((x) => x.id === l.fromSceneId))).toBe(true)
    expect(s.npcs.map((n) => n.id)).toContain('npc_bruno')
    expect(s.enemies.map((n) => n.id)).toEqual(['eny_ratto'])
    expect(s.items.map((n) => n.id)).toContain('itm_chiave')
  })

  it('blocca solo per gli errori dentro l’ambito', () => {
    expect(blockingIssues(p, { kind: 'all' }).map((i) => i.target.id)).toContain('scn_covo')
    expect(blockingIssues(p, { kind: 'group', groupId: 'grp_locanda' })).toEqual([])
  })

  it('JSON senza dati solo-editor, reimportabile', () => {
    const json = exportJson(p, { kind: 'all' })
    const parsed = JSON.parse(json)
    expect(parsed.format).toBe('graforum-export')
    expect(parsed.project.scenes[0].position).toBeUndefined()
    const back = importJson(json)
    expect(back.scenes).toHaveLength(p.scenes.length)
    expect(back.scenes[0]!.position).toBeDefined()
    expect(back.links).toEqual(p.links)
  })

  it('HTML leggibile per il tavolo', () => {
    const html = exportHtml(p, { kind: 'all' })
    expect(html).toContain('<h3>Cantina infestata')
    expect(html).toContain('Ratto gigante')
    expect(html).not.toContain('<script')
  })
})
