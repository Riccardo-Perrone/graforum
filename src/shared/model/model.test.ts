import { describe, expect, it } from 'vitest'
import { Project, buildUsageIndex, createEmptyProject, newId } from './index'
import { existingIds, findRefs } from '../engine/refs'
import { sampleProject } from '../sample/locanda-del-corvo'

describe('modello', () => {
  it('genera id con prefisso di tipo', () => {
    expect(newId('scene')).toMatch(/^scn_[0-9A-Za-z]{10}$/)
  })

  it('crea un progetto vuoto con abilità e tipi di oggetto predefiniti', () => {
    const project = createEmptyProject('Prova')
    expect(project.settings.skills.find((s) => s.id === 'skl_percezione')?.ability).toBe('wis')
    expect(project.settings.itemTypes.map((t) => t.name)).toContain('Chiave')
  })

  it('il progetto di esempio è valido e sopravvive a un giro JSON', () => {
    const project = sampleProject()
    const roundTrip = Project.parse(JSON.parse(JSON.stringify(project)))
    expect(roundTrip).toEqual(project)
    expect(project.scenes).toHaveLength(11)
    expect(project.links.find((l) => l.id === 'lnk_sala_cantina')?.gate.whenUnmet).toBe('locked')
  })

  it('l’indice "Usato in" trova scene, dialoghi, quest e documenti', () => {
    const usage = buildUsageIndex(sampleProject())
    const usedBy = (id: string) => (usage.get(id) ?? []).map((o) => o.id).sort()
    expect(usedBy('npc_bruno')).toEqual(['dlg_avvertimento', 'dlg_benvenuto', 'doc_note', 'scn_cantina', 'scn_sala'])
    expect(usedBy('itm_chiave')).toEqual(['dlg_benvenuto', 'lnk_sala_cantina'])
    expect(usedBy('dlg_benvenuto')).toEqual(['qst_cantina', 'scn_sala'])
    expect(usedBy('enc_ratti')).toEqual(['qst_cantina', 'scn_cantina'])
  })

  it('un suono associato a una scena compare in "Usato in" e nei riferimenti', () => {
    const p = sampleProject()
    p.sounds.push({ id: 'snd_taverna', fileName: 'taverna.mp3', title: 'Taverna', tags: [], mime: 'audio/mpeg', folder: '' })
    p.scenes[0]!.soundIds.push('snd_taverna')
    expect((buildUsageIndex(p).get('snd_taverna') ?? []).map((o) => o.id)).toEqual([p.scenes[0]!.id])
    expect(findRefs(p.scenes[0]).filter((r) => r.type === 'sound').map((r) => r.id)).toEqual(['snd_taverna'])
    expect(existingIds(p).sound.has('snd_taverna')).toBe(true)
    expect(newId('sound')).toMatch(/^snd_/)
  })
})
