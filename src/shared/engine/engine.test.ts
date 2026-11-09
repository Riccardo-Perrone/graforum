import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import {
  applyEffects,
  decisivePath,
  describeCondition,
  evalCondition,
  filterDialogEntries,
  filterDialogs,
  gateStatus,
  initialPlayState,
  listDialogEntries,
  stepsSatisfiedBy,
  updateState,
  validate
} from './index'

const p = sampleProject()

describe('validazione', () => {
  const issues = validate(p)
  const titles = (sev: string) => issues.filter((i) => i.severity === sev).map((i) => `${i.title}:${i.target.id}`)

  it('segnala la scena Warning senza incontro e il vicolo cieco', () => {
    expect(titles('error')).toContain('Scena Warning senza incontro:scn_covo')
    expect(titles('warning')).toContain('Vicolo cieco:scn_pozzo')
    expect(titles('warning')).not.toContain('Vicolo cieco:scn_alba')
  })

  it('non segnala condizioni impossibili nel progetto di esempio', () => {
    expect(titles('warning').filter((t) => t.startsWith('Condizione impossibile'))).toEqual([])
  })

  it('segnala riferimenti a entità eliminate e scene irraggiungibili', () => {
    const broken = structuredClone(p)
    broken.items = broken.items.filter((i) => i.id !== 'itm_chiave')
    broken.links = broken.links.filter((l) => l.id !== 'lnk_emporio_pozzo')
    const t = validate(broken).map((i) => `${i.title}:${i.target.id}`)
    expect(t).toContain('Riferimento a entità eliminata:lnk_sala_cantina')
    expect(t).toContain('Scena irraggiungibile:scn_pozzo')
  })
})

describe('percorso decisivo', () => {
  it('collega partenza e finale buono', () => {
    const path = decisivePath(p, 'end_buono')
    expect(path.sceneIds.has('scn_piazza')).toBe(true)
    expect(path.sceneIds.has('scn_covo')).toBe(true)
    expect(path.sceneIds.has('scn_patto')).toBe(false)
    expect(path.linkIds.has('lnk_covo_alba')).toBe(true)
  })
})

describe('playtest', () => {
  it('condizioni, gate bloccato e avanzamento automatico degli step', () => {
    let s = initialPlayState(p)
    const link = p.links.find((l) => l.id === 'lnk_sala_cantina')!
    expect(gateStatus(p, s, link.gate, link.id)).toBe('locked')

    // Scelta di dialogo riuscita: ottiene la chiave, avvia la quest, lo step 1 si completa da solo.
    s = updateState(p, s, (x) => {
      x.choices.push('dch_cantina')
    })
    s = applyEffects(p, s, [
      { type: 'gainItem', itemId: 'itm_chiave', quantity: 1 },
      { type: 'questStart', questId: 'qst_cantina' }
    ])
    expect(gateStatus(p, s, link.gate, link.id)).toBe('open')
    expect(s.stepStates['stp_bruno']).toBe('completed')
    expect(s.questStates['qst_cantina']).toBe('inProgress')

    s = updateState(p, s, (x) => {
      x.encounters['enc_ratti'] = 'win'
      x.inventory['itm_diario'] = 1
    })
    expect(s.questStates['qst_cantina']).toBe('completed')
    expect(evalCondition(p, s, { type: 'questState', questId: 'qst_cantina', stepId: null, state: 'completed' })).toBe(true)
  })

  it('descrive le condizioni in italiano', () => {
    expect(describeCondition(p, p.links.find((l) => l.id === 'lnk_sala_cantina')!.gate.condition)).toBe('possiede Chiave della cantina')
  })

  it('collega gli step di quest alle loro fonti', () => {
    expect(stepsSatisfiedBy(p, 'dialog', 'dlg_benvenuto').map((x) => x.stepId)).toEqual(['stp_bruno'])
    expect(stepsSatisfiedBy(p, 'encounter', 'enc_ratti').map((x) => x.stepId)).toEqual(['stp_ratti'])
  })
})

describe('avanzamento', () => {
  it('elenca condizioni, effetti e prove ordinati per distanza dalla partenza', async () => {
    const { progressRows } = await import('./progress')
    const rows = progressRows(p)
    expect(rows[0]!.distance).toBe(1)
    expect(rows.some((r) => r.kind === 'check' && r.detail.startsWith('Percezione CD 13'))).toBe(true)
    expect(rows.some((r) => r.kind === 'condition' && r.detail.includes('Chiave della cantina'))).toBe(true)
    const d = rows.map((r) => r.distance)
    expect([...d].sort((a, b) => a - b)).toEqual(d)
  })
})

describe('elenco dialoghi', () => {
  const all = listDialogEntries(p)
  it('elenca battute e scelte con le scene di assegnazione', () => {
    expect(all.length).toBeGreaterThan(0)
    expect(all.some((e) => e.kind === 'choice')).toBe(true)
  })
  it('filtra per NPC, scena e testo', () => {
    const e = all[0]!
    expect(filterDialogEntries(all, { npcId: e.npcId }).every((x) => x.npcId === e.npcId)).toBe(true)
    expect(filterDialogEntries(all, { query: e.text.slice(0, 5).toUpperCase() })).toContain(e)
    expect(filterDialogEntries(all, { query: 'zzzzqqqq' })).toHaveLength(0)
    const withScene = all.find((x) => x.sceneIds.length)
    if (withScene) expect(filterDialogEntries(all, { sceneId: withScene.sceneIds[0] }).every((x) => x.sceneIds.includes(withScene.sceneIds[0]!))).toBe(true)
  })
})

describe('dialoghi principali', () => {
  const all = listDialogEntries(p)
  it('un elemento per dialogo e ricerca nel contenuto', () => {
    expect(filterDialogs(p, all, {})).toHaveLength(p.dialogs.length)
    const e = all[0]!
    const found = filterDialogs(p, all, { query: e.text.slice(0, 5) })
    expect(found.some((d) => d.id === e.dialogId && d.matches.length > 0)).toBe(true)
    expect(filterDialogs(p, all, { query: 'zzzzqqqq' })).toHaveLength(0)
  })
})
