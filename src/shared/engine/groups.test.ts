import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { canMoveGroupInto, commonAncestor, fullySelectedGroups, planGrouping, planMoveInto, pruneGroupEnds, selectedGroups } from './groups'

// Esempio: Villaggio (piazza, emporio, pozzo) ⊃ Locanda (sala, camera3, cantina, tesoro); fuori: strada, covo, alba, patto.
const p = sampleProject()
const LOCANDA = ['scn_sala', 'scn_camera3', 'scn_cantina', 'scn_tesoro']
const VILLAGGIO = ['scn_piazza', 'scn_emporio', 'scn_pozzo', ...LOCANDA]

describe('gruppi selezionati', () => {
  it('un gruppo è selezionato quando lo sono tutte le sue scene, sottogruppi compresi', () => {
    expect([...fullySelectedGroups(p, LOCANDA)]).toEqual(['grp_locanda'])
    expect([...fullySelectedGroups(p, VILLAGGIO)].sort()).toEqual(['grp_brumavalle', 'grp_locanda'])
  })

  it('manca una scena: il gruppo non è selezionato', () => {
    expect(fullySelectedGroups(p, LOCANDA.slice(1)).size).toBe(0)
    // Tutte le scene dirette del Villaggio ma non quelle della Locanda: il Villaggio non è intero.
    expect(fullySelectedGroups(p, ['scn_piazza', 'scn_emporio', 'scn_pozzo']).has('grp_brumavalle')).toBe(false)
  })

  it('un gruppo vuoto non risulta mai selezionato', () => {
    const q = { ...p, groups: [...p.groups, { id: 'grp_vuoto', parentId: null }] }
    expect(fullySelectedGroups(q, []).size).toBe(0)
  })
})

describe('antenato comune', () => {
  it('trova il gruppo più vicino che contiene tutte le posizioni', () => {
    expect(commonAncestor(p.groups, ['grp_locanda', 'grp_brumavalle'])).toBe('grp_brumavalle')
    expect(commonAncestor(p.groups, ['grp_locanda', 'grp_locanda'])).toBe('grp_locanda')
    expect(commonAncestor(p.groups, ['grp_locanda', null])).toBeNull()
    expect(commonAncestor(p.groups, [])).toBeNull()
  })
})

describe('raggruppa la selezione', () => {
  it('gruppo intero + una scena fuori: il gruppo resta intero e diventa sottogruppo', () => {
    const plan = planGrouping(p, [...LOCANDA, 'scn_strada'])
    expect(plan).toEqual({ parentId: null, groupIds: ['grp_locanda'], sceneIds: ['scn_strada'] })
  })

  it('gruppo intero + una scena dello stesso gruppo padre: il nuovo gruppo nasce nel padre', () => {
    const plan = planGrouping(p, [...LOCANDA, 'scn_piazza'])
    expect(plan).toEqual({ parentId: 'grp_brumavalle', groupIds: ['grp_locanda'], sceneIds: ['scn_piazza'] })
  })

  it('selezionare tutto il Villaggio porta con sé anche la Locanda, che resta dentro il Villaggio', () => {
    const plan = planGrouping(p, [...VILLAGGIO, 'scn_strada'])
    expect(plan.groupIds).toEqual(['grp_brumavalle'])
    expect(plan.sceneIds).toEqual(['scn_strada'])
  })

  it('solo scene sciolte dello stesso gruppo: il nuovo gruppo è annidato lì, come prima', () => {
    expect(planGrouping(p, ['scn_sala', 'scn_cantina'])).toEqual({ parentId: 'grp_locanda', groupIds: [], sceneIds: ['scn_sala', 'scn_cantina'] })
  })

  it('una carta di gruppo collassato selezionata conta come gruppo intero', () => {
    expect(planGrouping(p, ['scn_strada'], ['grp_locanda'])).toEqual({ parentId: null, groupIds: ['grp_locanda'], sceneIds: ['scn_strada'] })
  })
})

describe('spostare dentro un gruppo', () => {
  const withB = { ...p, groups: [...p.groups, { id: 'grp_b', parentId: null }] }

  it('un gruppo entra in un altro gruppo come una scena singola', () => {
    expect(planMoveInto(withB, 'grp_b', [], ['grp_locanda'])).toEqual({ groupIds: ['grp_locanda'], sceneIds: [] })
  })

  it('una selezione con un gruppo intero lo sposta intero, le altre scene entrano direttamente', () => {
    expect(planMoveInto(withB, 'grp_b', [...LOCANDA, 'scn_strada'])).toEqual({ groupIds: ['grp_locanda'], sceneIds: ['scn_strada'] })
  })

  it('niente cicli e niente salite di livello', () => {
    expect(canMoveGroupInto(p.groups, 'grp_brumavalle', 'grp_locanda')).toBe(false) // dentro un suo discendente
    expect(canMoveGroupInto(p.groups, 'grp_locanda', 'grp_locanda')).toBe(false) // dentro se stesso
    expect(canMoveGroupInto(p.groups, 'grp_locanda', 'grp_brumavalle')).toBe(false) // già nel genitore
    expect(planMoveInto(p, 'grp_locanda', [], ['grp_brumavalle'])).toEqual({ groupIds: [], sceneIds: [] })
    // Le scene di un gruppo che non può spostarsi non vengono sparpagliate nel bersaglio.
    expect(planMoveInto(p, 'grp_locanda', VILLAGGIO)).toEqual({ groupIds: [], sceneIds: [] })
  })
})

describe('carte di gruppi collassati', () => {
  it('una carta selezionata più tutte le altre scene del padre rende intero anche il padre', () => {
    expect([...selectedGroups(p, ['scn_piazza', 'scn_emporio', 'scn_pozzo'], ['grp_locanda'])].sort()).toEqual(['grp_brumavalle', 'grp_locanda'])
    expect(selectedGroups(p, ['scn_piazza'], ['grp_locanda']).has('grp_brumavalle')).toBe(false)
  })
})

describe('entrate e uscite dopo uno spostamento', () => {
  it('toglie quelle che non sono più scene del gruppo o dei sottogruppi, tiene le altre', () => {
    const q = structuredClone(p)
    // La Locanda esce dal Villaggio: la sala non può più essere entrata del Villaggio, la piazza sì.
    q.groups.find((g) => g.id === 'grp_locanda')!.parentId = null
    q.groups.find((g) => g.id === 'grp_brumavalle')!.entrySceneIds = ['scn_piazza', 'scn_sala']
    pruneGroupEnds(q)
    expect(q.groups.find((g) => g.id === 'grp_brumavalle')!.entrySceneIds).toEqual(['scn_piazza'])
    expect(q.groups.find((g) => g.id === 'grp_locanda')!.exitSceneIds).toEqual(['scn_sala', 'scn_tesoro'])
  })
})
