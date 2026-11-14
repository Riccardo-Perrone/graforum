import { describe, expect, it } from 'vitest'
import { sampleProject } from '../sample/locanda-del-corvo'
import { loadProject } from './load'
import { SCHEMA_VERSION } from './project'

const raw = (extra: Record<string, unknown> = {}) => ({ ...JSON.parse(JSON.stringify(sampleProject())), ...extra })

describe('loadProject', () => {
  it('legge un progetto corrente senza cambiarlo', () => {
    expect(loadProject(raw())).toEqual(sampleProject())
  })

  it('rifiuta un file più recente dell’app con un messaggio comprensibile', () => {
    expect(() => loadProject(raw({ schemaVersion: SCHEMA_VERSION + 1 }))).toThrow(/più recente/)
  })

  it('rifiuta valori che non sono un progetto', () => {
    for (const v of [null, 'x', 42, []]) expect(() => loadProject(v)).toThrow(/non contiene un progetto/)
  })
})
