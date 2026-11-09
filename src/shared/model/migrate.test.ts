import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { MIGRATIONS, migrateProject, migrateRaw, type Migration } from './migrate'
import { SCHEMA_VERSION } from './project'

const raw = (extra: Record<string, unknown> = {}) => ({ ...JSON.parse(JSON.stringify(sampleProject())), ...extra })

describe('migrateRaw', () => {
  const fakes: Record<number, Migration> = {
    1: (r) => ({ ...r, titolo: r['name'] }),
    2: (r) => {
      const { titolo, ...rest } = r
      return { ...rest, name: `${String(titolo)}!` }
    }
  }

  it('applica le migrazioni in sequenza fino alla versione richiesta', () => {
    const out = migrateRaw({ schemaVersion: 1, name: 'A' }, fakes, 3)
    expect(out.fromVersion).toBe(1)
    expect(out.raw).toEqual({ schemaVersion: 3, name: 'A!' })
  })

  it('parte dal punto giusto e non tocca un file già aggiornato', () => {
    expect(migrateRaw({ schemaVersion: 2, titolo: 'B' }, fakes, 3).raw).toEqual({ schemaVersion: 3, name: 'B!' })
    expect(migrateRaw({ schemaVersion: 3, name: 'C' }, fakes, 3).raw).toEqual({ schemaVersion: 3, name: 'C' })
  })

  it('non modifica l’oggetto ricevuto', () => {
    const input = { schemaVersion: 1, name: 'A' }
    migrateRaw(input, fakes, 3)
    expect(input).toEqual({ schemaVersion: 1, name: 'A' })
  })

  it('senza numero di versione parte dal primo formato', () => {
    expect(migrateRaw({ name: 'D' }, fakes, 2).fromVersion).toBe(1)
  })

  it('rifiuta un file più recente dell’app con un messaggio comprensibile', () => {
    expect(() => migrateRaw({ schemaVersion: 4 }, fakes, 3)).toThrow(/più recente/)
  })

  it('segnala una migrazione mancante', () => {
    expect(() => migrateRaw({ schemaVersion: 1 }, {}, 2)).toThrow(/Manca la migrazione/)
  })

  it('rifiuta valori che non sono un progetto o con versione non valida', () => {
    for (const v of [null, 'x', 42, []]) expect(() => migrateRaw(v)).toThrow()
    for (const schemaVersion of [0, -1, 1.5, '1']) expect(() => migrateRaw({ schemaVersion })).toThrow()
  })
})

describe('migrateProject', () => {
  it('legge un progetto corrente senza cambiarlo', () => {
    const out = migrateProject(raw())
    expect(out.fromVersion).toBe(SCHEMA_VERSION)
    expect(out.project).toEqual(sampleProject())
  })

  it('ogni versione precedente a quella corrente ha la sua migrazione', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) expect(MIGRATIONS[v], `manca MIGRATIONS[${v}]`).toBeTypeOf('function')
  })
})
