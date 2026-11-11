import { describe, expect, it } from 'vitest'
import { DialogChoice, DialogLine, ENDING_COLORS, Encounter, Ending, Group, Link, Scene } from './index'
import { makeDialogChoice, makeDialogLine, makeEncounter, makeEnding, makeGroup, makeLink, makeScene } from './factories'

// Le fabbriche devono produrre entità che lo schema accetta così come sono (nessun campo mancante).

describe('fabbriche delle entità', () => {
  it('scena vuota valida, con posizione arrotondata e gruppo opzionale', () => {
    const s = makeScene({ x: 10.6, y: -3.2 }, { groupId: 'grp_a' })
    expect(Scene.parse(s)).toEqual(s)
    expect(s.id).toMatch(/^scn_/)
    expect(s).toMatchObject({ title: 'Nuova scena', groupId: 'grp_a', position: { x: 11, y: -3 }, tag: 'neutral', access: { condition: null, whenUnmet: 'hidden' } })
    expect(makeScene({ x: 0, y: 0 }).groupId).toBeNull()
  })

  it('collegamento senza condizioni né prove', () => {
    const l = makeLink('scn_a', 'scn_b')
    expect(Link.parse(l)).toEqual(l)
    expect(l).toMatchObject({ fromSceneId: 'scn_a', toSceneId: 'scn_b', bidirectional: false, effects: [], checks: [] })
  })

  it('incontro con esiti vuoti ed enemy opzionali', () => {
    const e = makeEncounter('Agguato', ['eny_a', 'eny_b'])
    expect(Encounter.parse(e)).toEqual(e)
    expect(e.enemies).toEqual([
      { enemyId: 'eny_a', quantity: 1 },
      { enemyId: 'eny_b', quantity: 1 }
    ])
    expect(e.outcomes.win).toEqual({ target: null, effects: [] })
    expect(makeEncounter('Vuoto').enemies).toEqual([])
  })

  it('battuta e scelta di dialogo', () => {
    const line = makeDialogLine({ x: 5, y: 6 })
    expect(DialogLine.parse(line)).toEqual(line)
    expect(line).toMatchObject({ speaker: { kind: 'npc' }, text: '', choices: [], position: { x: 5, y: 6 } })
    const choice = makeDialogChoice(line.id)
    expect(DialogChoice.parse(choice)).toEqual(choice)
    expect(choice.targetLineId).toBe(line.id)
    expect(makeDialogChoice().targetLineId).toBeNull()
  })

  it('finale con il colore della tavolozza a rotazione', () => {
    const first = makeEnding('scn_a', 0)
    expect(Ending.parse(first)).toEqual(first)
    expect(first).toMatchObject({ sceneId: 'scn_a', label: 'Nuovo finale', color: ENDING_COLORS[0], manualDecisive: [] })
    expect(makeEnding('scn_a', 1).color).toBe(ENDING_COLORS[1])
    expect(makeEnding('scn_a', ENDING_COLORS.length).color).toBe(ENDING_COLORS[0])
    // Il colore predefinito dello schema è il primo della tavolozza.
    expect(Ending.parse({ id: 'end_x', sceneId: 'scn_a' }).color).toBe(ENDING_COLORS[0])
  })

  it('gruppo vuoto, al primo livello o dentro un altro gruppo', () => {
    const g = makeGroup('Cripta', 'grp_a')
    expect(Group.parse(g)).toEqual(g)
    expect(g).toMatchObject({ name: 'Cripta', parentId: 'grp_a', entrySceneIds: [], exitSceneIds: [], collapsed: false })
    expect(makeGroup('Fuori').parentId).toBeNull()
  })

  it('ogni chiamata genera un id nuovo', () => {
    expect(makeLink('a', 'b').id).not.toBe(makeLink('a', 'b').id)
  })
})
