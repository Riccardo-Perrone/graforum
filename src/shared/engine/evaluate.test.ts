import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { applyEffects, evalCondition, gateStatus, initialPlayState, questState } from './index'

const p = sampleProject()

describe('stato iniziale del playtest', () => {
  it('parte dalla scena iniziale con i flag ai valori predefiniti', () => {
    const s = initialPlayState(p)
    expect(s.sceneId).toBe('scn_piazza')
    expect(s.flags).toEqual({ flg_chiesto_cantina: false, flg_cantina_visitata: false })
    expect(s.inventory).toEqual({})
  })

  it('applica un preset: oggetti, stati di quest e step, flag', () => {
    const s = initialPlayState(p, {
      id: 'pre_x',
      name: 'Prova',
      items: [{ itemId: 'itm_chiave', quantity: 2 }],
      quests: [
        { questId: 'qst_cantina', stepId: null, state: 'inProgress' },
        { questId: 'qst_cantina', stepId: 'stp_bruno', state: 'completed' }
      ],
      flags: [{ flagId: 'flg_chiesto_cantina', value: true }]
    })
    expect(s.inventory['itm_chiave']).toBe(2)
    expect(questState(s, 'qst_cantina')).toBe('inProgress')
    expect(s.stepStates['stp_bruno']).toBe('completed')
    expect(s.flags['flg_chiesto_cantina']).toBe(true)
  })
})

describe('effetti', () => {
  it('ottiene e perde oggetti; a zero l’oggetto sparisce dall’inventario', () => {
    let s = applyEffects(p, initialPlayState(p), [{ type: 'gainItem', itemId: 'itm_chiave', quantity: 3 }])
    expect(s.inventory['itm_chiave']).toBe(3)
    s = applyEffects(p, s, [{ type: 'loseItem', itemId: 'itm_chiave', quantity: 2 }])
    expect(s.inventory['itm_chiave']).toBe(1)
    s = applyEffects(p, s, [{ type: 'loseItem', itemId: 'itm_chiave', quantity: 5 }])
    expect('itm_chiave' in s.inventory).toBe(false)
  })

  it('non modifica lo stato di partenza (immutabile)', () => {
    const start = initialPlayState(p)
    applyEffects(p, start, [{ type: 'setFlag', flagId: 'flg_chiesto_cantina', value: true }])
    expect(start.flags['flg_chiesto_cantina']).toBe(false)
  })

  it('sblocca e blocca: il gate dell’entità ignora la sua condizione', () => {
    const link = p.links.find((l) => l.id === 'lnk_sala_cantina')!
    let s = initialPlayState(p)
    expect(gateStatus(p, s, link.gate, link.id)).toBe('locked')
    s = applyEffects(p, s, [{ type: 'unlock', target: { type: 'link', id: link.id } }])
    expect(gateStatus(p, s, link.gate, link.id)).toBe('open')
    s = applyEffects(p, s, [{ type: 'lock', target: { type: 'link', id: link.id } }])
    expect(gateStatus(p, s, link.gate, link.id)).toBe('locked')
    expect(s.unlocked).not.toContain(link.id)
  })

  it('avanzare a uno step completa i precedenti e mette in corso quello indicato', () => {
    const s = applyEffects(p, initialPlayState(p), [{ type: 'questAdvance', questId: 'qst_cantina', stepId: 'stp_diario' }])
    expect(questState(s, 'qst_cantina')).toBe('inProgress')
    expect(s.stepStates['stp_bruno']).toBe('completed')
    expect(s.stepStates['stp_ratti']).toBe('completed')
    expect(s.stepStates['stp_diario']).toBe('inProgress')
  })

  it('completare la quest completa tutti gli step', () => {
    const s = applyEffects(p, initialPlayState(p), [{ type: 'questComplete', questId: 'qst_cantina', stepId: null }])
    expect(questState(s, 'qst_cantina')).toBe('completed')
    expect(p.quests.find((q) => q.id === 'qst_cantina')!.steps.every((st) => s.stepStates[st.id] === 'completed')).toBe(true)
  })
})

describe('condizioni', () => {
  const s = initialPlayState(p)

  it('un gruppo O vuoto e una condizione assente sono sempre veri', () => {
    expect(evalCondition(p, s, null)).toBe(true)
    expect(evalCondition(p, s, { type: 'group', op: 'or', children: [] })).toBe(true)
  })

  it('E e O combinano le foglie', () => {
    const t = { type: 'flag' as const, flagId: 'flg_chiesto_cantina', value: false }
    const f = { type: 'flag' as const, flagId: 'flg_chiesto_cantina', value: true }
    expect(evalCondition(p, s, { type: 'group', op: 'and', children: [t, f] })).toBe(false)
    expect(evalCondition(p, s, { type: 'group', op: 'or', children: [t, f] })).toBe(true)
  })

  it('le condizioni personalizzate valgono solo se segnate a mano', () => {
    const c = { type: 'freeText' as const, text: 'Il master decide', ref: null }
    expect(evalCondition(p, s, c)).toBe(false)
    expect(evalCondition(p, { ...s, manual: { [JSON.stringify(c)]: true } }, c)).toBe(true)
  })

  it('esito di un incontro: specifico o qualsiasi', () => {
    const won = { ...s, encounters: { enc_ratti: 'win' as const } }
    expect(evalCondition(p, won, { type: 'encounterOutcome', encounterId: 'enc_ratti', outcome: 'any' })).toBe(true)
    expect(evalCondition(p, won, { type: 'encounterOutcome', encounterId: 'enc_ratti', outcome: 'flee' })).toBe(false)
    expect(evalCondition(p, s, { type: 'encounterOutcome', encounterId: 'enc_ratti', outcome: 'any' })).toBe(false)
  })
})
