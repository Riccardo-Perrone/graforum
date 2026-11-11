import { describe, expect, it } from 'vitest'
import { sampleProject } from '@shared/sample/locanda-del-corvo'
import { useUiStore } from '../../store/ui'
import { EMPTY_FILTERS, filterScenes, filtersActive, search, useFilterStore, type Filters } from './search'

const p = sampleProject()
const f = (extra: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...extra })

describe('ricerca globale', () => {
  it('trova scene per titolo e cataloghi per nome, senza distinguere maiuscole', () => {
    const r = search(p, 'CANTINA')
    expect(r.some((x) => x.type === 'scene' && x.id === 'scn_cantina' && x.sub === 'titolo')).toBe(true)
    expect(r.some((x) => x.type === 'quest' && x.id === 'qst_cantina')).toBe(true)
  })

  it('per un NPC indica le scene da evidenziare nel grafo', () => {
    const bruno = search(p, 'bruno').find((x) => x.id === 'npc_bruno')!
    expect(bruno.sceneIds.sort()).toEqual(['scn_cantina', 'scn_sala'])
  })

  it('una ricerca vuota non restituisce nulla', () => {
    expect(search(p, '   ')).toEqual([])
  })

  it('distingue gli accenti come tutte le ricerche dell’app', () => {
    const q = structuredClone(p)
    q.scenes[0]!.title = 'Città del Corvo'
    expect(search(q, 'città').some((r) => r.id === q.scenes[0]!.id)).toBe(true)
    expect(search(q, 'CITTÀ').some((r) => r.id === q.scenes[0]!.id)).toBe(true)
    expect(search(q, 'citta').some((r) => r.id === q.scenes[0]!.id)).toBe(false)
  })
})

describe('viste salvate dei filtri', () => {
  it('stanno nelle preferenze dell’app e si sostituiscono per nome', () => {
    useFilterStore.getState().setFilters({ tags: ['warning'] })
    useFilterStore.getState().save('Pericoli')
    useFilterStore.getState().setFilters({ tags: ['safe'] })
    useFilterStore.getState().save('Pericoli')
    expect(useUiStore.getState().savedFilters).toEqual([{ name: 'Pericoli', filters: f({ tags: ['safe'] }) }])
    useFilterStore.getState().remove('Pericoli')
    expect(useUiStore.getState().savedFilters).toEqual([])
  })
})

describe('filtri delle scene', () => {
  it('senza filtri passano tutte le scene', () => {
    expect(filtersActive(EMPTY_FILTERS)).toBe(false)
    expect(filterScenes(p, EMPTY_FILTERS).size).toBe(p.scenes.length)
  })

  it('il filtro per gruppo include i sottogruppi', () => {
    const ids = filterScenes(p, f({ groupId: 'grp_brumavalle' }))
    expect(ids.has('scn_piazza')).toBe(true)
    expect(ids.has('scn_cantina')).toBe(true) // nel sottogruppo "Locanda"
    expect(ids.has('scn_covo')).toBe(false)
  })

  it('filtra per tag, finali, problemi ed entità usata', () => {
    expect([...filterScenes(p, f({ tags: ['warning'] }))].every((id) => p.scenes.find((s) => s.id === id)!.tag === 'warning')).toBe(true)
    expect([...filterScenes(p, f({ endingsOnly: true }))].sort()).toEqual(p.endings.map((e) => e.sceneId).sort())
    expect(filterScenes(p, f({ withProblems: true })).has('scn_covo')).toBe(true)
    // Il dialogo di benvenuto è assegnato in sala: la scena compare anche se il dialogo non è citato direttamente.
    expect(filterScenes(p, f({ entity: { type: 'dialog', id: 'dlg_benvenuto' } })).has('scn_sala')).toBe(true)
  })

  it('i filtri si combinano', () => {
    expect(filtersActive(f({ tags: ['safe'] }))).toBe(true)
    const ids = filterScenes(p, f({ groupId: 'grp_locanda', tags: ['warning'] }))
    expect([...ids].every((id) => p.scenes.find((s) => s.id === id)!.groupId === 'grp_locanda')).toBe(true)
  })
})
