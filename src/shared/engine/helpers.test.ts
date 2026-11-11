import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { allChecks, canLink, checkName, groupAncestors, groupDescendants, isGroupOrAncestor, matchIndex, matchesAny, matchesQuery, scenesWithDialog, validate, validateCached } from './index'

const p = sampleProject()

describe('gerarchia dei gruppi', () => {
  // Elenco volutamente "al contrario": il nipote compare prima del figlio e del padre.
  const groups = [
    { id: 'c', parentId: 'b' },
    { id: 'b', parentId: 'a' },
    { id: 'a', parentId: null },
    { id: 'x', parentId: null }
  ]

  it('trova tutti i discendenti qualunque sia l’ordine dell’elenco', () => {
    expect([...groupDescendants(groups, 'a')].sort()).toEqual(['a', 'b', 'c'])
    expect([...groupDescendants(groups, 'c')]).toEqual(['c'])
    expect([...groupDescendants(p.groups, 'grp_brumavalle')].sort()).toEqual(['grp_brumavalle', 'grp_locanda'])
  })

  it('elenca gli antenati dal più interno al più esterno', () => {
    expect(groupAncestors(groups, 'c')).toEqual(['c', 'b', 'a'])
    expect(groupAncestors(groups, null)).toEqual([])
    expect(groupAncestors(groups, 'mancante')).toEqual([])
  })

  it('non si blocca su un ciclo di gruppi', () => {
    const loop = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' }
    ]
    expect(groupAncestors(loop, 'a')).toEqual(['a', 'b'])
    expect([...groupDescendants(loop, 'a')].sort()).toEqual(['a', 'b'])
  })

  it('riconosce il gruppo stesso o un suo antenato', () => {
    expect(isGroupOrAncestor(groups, 'a', 'c')).toBe(true)
    expect(isGroupOrAncestor(groups, 'c', 'c')).toBe(true)
    expect(isGroupOrAncestor(groups, 'c', 'a')).toBe(false)
    expect(isGroupOrAncestor(groups, 'x', 'c')).toBe(false)
  })
})

describe('unicità dei collegamenti (canLink)', () => {
  const links = (list: { id: string; fromSceneId: string; toSceneId: string; bidirectional: boolean }[]) => ({ links: list }) as Parameters<typeof canLink>[0]

  it('vieta il collegamento di una scena a se stessa', () => {
    expect(canLink(links([]), 'a', 'a')).toBe(false)
  })

  it('permette A→B e poi B→A, ma non un secondo A→B', () => {
    const one = links([{ id: 'l1', fromSceneId: 'a', toSceneId: 'b', bidirectional: false }])
    expect(canLink(one, 'a', 'b')).toBe(false)
    expect(canLink(one, 'b', 'a')).toBe(true)
  })

  it('A↔B esclude ogni altro collegamento tra le due scene', () => {
    const both = links([{ id: 'l1', fromSceneId: 'a', toSceneId: 'b', bidirectional: true }])
    expect(canLink(both, 'b', 'a')).toBe(false)
    expect(canLink(both, 'a', 'c')).toBe(true)
  })

  it('un bidirezionale si può creare solo se tra le scene non c’è nulla', () => {
    const one = links([{ id: 'l1', fromSceneId: 'a', toSceneId: 'b', bidirectional: false }])
    expect(canLink(one, 'b', 'a', true)).toBe(false)
    // Modificando proprio quel collegamento (ignoreId) si può renderlo bidirezionale.
    expect(canLink(one, 'a', 'b', true, 'l1')).toBe(true)
  })

  it('è coerente con il progetto di esempio', () => {
    expect(canLink(p, 'scn_piazza', 'scn_sala')).toBe(false)
    expect(canLink(p, 'scn_pozzo', 'scn_emporio')).toBe(true)
  })
})

describe('prove di abilità', () => {
  it('raccoglie le prove di collegamenti, scene e scelte di dialogo', () => {
    const ids = allChecks(p).map((c) => c.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(checkName(p, id)).not.toBe('(prova eliminata)')
    expect(checkName(p, 'chk_inesistente')).toBe('(prova eliminata)')
  })
})

describe('dialoghi assegnati', () => {
  it('trova le scene in cui un dialogo è assegnato a un NPC', () => {
    expect(scenesWithDialog(p, 'dlg_benvenuto').map((s) => s.id)).toEqual(['scn_sala'])
    expect(scenesWithDialog(p, 'dlg_inesistente')).toEqual([])
  })
})

describe('confronto del testo nelle ricerche', () => {
  it('maiuscole indifferenti, accenti distinti', () => {
    expect(matchesQuery('Città PERDUTA', 'città')).toBe(true)
    expect(matchesQuery('Città perduta', 'CITTÀ')).toBe(true)
    expect(matchesQuery('Città perduta', 'citta')).toBe(false)
    expect(matchesQuery('Citta perduta', 'città')).toBe(false)
  })

  it('una ricerca vuota o di soli spazi trova tutto', () => {
    expect(matchesQuery('qualsiasi', '   ')).toBe(true)
    expect(matchesAny('', undefined, null)).toBe(true)
  })

  it('cerca in più testi, ignorando quelli assenti', () => {
    expect(matchesAny('bruno', undefined, 'Oste Bruno')).toBe(true)
    expect(matchesAny('bruno', null, 'Oste')).toBe(false)
  })

  it('la posizione trovata vale sul testo originale', () => {
    const text = 'La Città del Corvo'
    const i = matchIndex(text, ' città ')
    expect(text.slice(i, i + 'città'.length)).toBe('Città')
    expect(matchIndex(text, 'zzz')).toBe(-1)
    expect(matchIndex(text, '')).toBe(-1)
  })
})

describe('validateCached', () => {
  it('restituisce lo stesso risultato di validate, calcolato una volta per progetto', () => {
    const a = validateCached(p)
    expect(a).toEqual(validate(p))
    expect(validateCached(p)).toBe(a)
    expect(validateCached(structuredClone(p))).not.toBe(a)
  })
})
