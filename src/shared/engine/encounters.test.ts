import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { makeEncounter } from '../model'
import { encounterBlockers, encountersOrphanedBy, encountersWithoutScene, validate } from './index'

describe('incontri senza scena', () => {
  it('nell’esempio ogni incontro sta in una scena', () => {
    expect(encountersWithoutScene(sampleProject())).toEqual([])
  })

  it('eliminando la scena il suo incontro resta orfano', () => {
    const p = sampleProject()
    expect(encountersOrphanedBy(p, { deletedSceneIds: new Set(['scn_cantina']) })).toEqual(['enc_ratti'])
    expect(encountersOrphanedBy(p, { deletedSceneIds: new Set(['scn_piazza']) })).toEqual([])
  })

  it('un incontro presente in due scene non è orfano se se ne elimina una', () => {
    const p = sampleProject()
    p.scenes.find((s) => s.id === 'scn_sala')!.encounterIds.push('enc_ratti')
    expect(encountersOrphanedBy(p, { deletedSceneIds: new Set(['scn_cantina']) })).toEqual([])
    expect(encountersOrphanedBy(p, { detached: { sceneId: 'scn_cantina', encounterId: 'enc_ratti' } })).toEqual([])
  })

  it('togliere l’incontro dalla sua unica scena lo rende orfano', () => {
    expect(encountersOrphanedBy(sampleProject(), { detached: { sceneId: 'scn_cantina', encounterId: 'enc_ratti' } })).toEqual(['enc_ratti'])
  })

  it('un incontro già orfano non si conta come effetto della modifica', () => {
    const p = sampleProject()
    p.encounters.push(makeEncounter('Dimenticato'))
    const orphan = p.encounters.at(-1)!.id
    expect(encountersWithoutScene(p)).toEqual([orphan])
    expect(encountersOrphanedBy(p, { deletedSceneIds: new Set(['scn_cantina']) })).toEqual(['enc_ratti'])
  })

  it('la validazione segnala l’incontro senza scena con un codice stabile', () => {
    const p = sampleProject()
    p.encounters.push(makeEncounter('Dimenticato'))
    const issue = validate(p).find((i) => i.code === 'encounterWithoutScene')
    expect(issue?.target).toEqual({ type: 'encounter', id: p.encounters.at(-1)!.id })
    expect(issue?.severity).toBe('warning')
  })
})

describe('chi blocca l’eliminazione di un incontro', () => {
  it('la quest che lo richiede blocca; la scena che lo contiene no', () => {
    const p = sampleProject()
    // Lo step "ratti" della quest chiede l'esito dell'incontro.
    expect(encounterBlockers(p, ['enc_ratti']).map((o) => o.id)).toEqual(['qst_cantina'])
  })

  it('ciò che sparisce insieme non blocca', () => {
    const p = sampleProject()
    expect(encounterBlockers(p, ['enc_ratti'], new Set(['qst_cantina']))).toEqual([])
  })

  it('un incontro che nessuno cita si elimina liberamente', () => {
    const p = sampleProject()
    p.encounters.push(makeEncounter('Libero'))
    expect(encounterBlockers(p, [p.encounters.at(-1)!.id])).toEqual([])
  })
})

describe('codici dei problemi', () => {
  it('ogni problema ha un codice, e lo stesso titolo ha sempre lo stesso codice', () => {
    const issues = validate(sampleProject())
    const byTitle = new Map<string, string>()
    for (const i of issues) {
      expect(i.code, i.title).toBeTruthy()
      expect(byTitle.get(i.title) ?? i.code).toBe(i.code)
      byTitle.set(i.title, i.code)
    }
    expect(issues.some((i) => i.code === 'warningWithoutEncounter' && i.target.id === 'scn_covo')).toBe(true)
    expect(issues.some((i) => i.code === 'deadEnd' && i.target.id === 'scn_pozzo')).toBe(true)
  })
})
