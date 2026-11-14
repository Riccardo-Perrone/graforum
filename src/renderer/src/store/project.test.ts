import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyProject } from '@shared/model'
import { isDirty, useProjectStore } from './project'

const store = () => useProjectStore.getState()
const name = () => store().project!.name

describe('progetto: modifiche, annulla e ripeti', () => {
  beforeEach(() => store().load(createEmptyProject('Prova'), '/tmp/prova.foru'))

  it('apply modifica il progetto senza toccare la versione precedente', () => {
    const before = store().project!
    store().apply('Rinomina', (d) => void (d.name = 'Nuovo'))
    expect(name()).toBe('Nuovo')
    expect(before.name).toBe('Prova')
    expect(store().past.map((h) => h.label)).toEqual(['Rinomina'])
  })

  it('una modifica che non cambia nulla non entra nella cronologia', () => {
    store().apply('Niente', () => {})
    expect(store().past).toHaveLength(0)
    expect(store().revision).toBe(0)
  })

  it('annulla e ripeti ripercorrono la cronologia; una nuova modifica cancella il "ripeti"', () => {
    store().apply('A', (d) => void (d.name = 'A'))
    store().apply('B', (d) => void (d.name = 'B'))
    store().undo()
    expect(name()).toBe('A')
    store().redo()
    expect(name()).toBe('B')
    store().undo()
    store().apply('C', (d) => void (d.name = 'C'))
    expect(store().future).toHaveLength(0)
    store().redo()
    expect(name()).toBe('C')
  })

  it('modifiche consecutive con la stessa mergeKey si annullano in un solo passo', () => {
    store().apply('Testo', (d) => void (d.description = 'a'), 'desc')
    store().apply('Testo', (d) => void (d.description = 'ab'), 'desc')
    store().apply('Testo', (d) => void (d.description = 'abc'), 'desc')
    expect(store().past).toHaveLength(1)
    store().undo()
    expect(store().project!.description).toBe('')
  })

  it('dopo un annulla la stessa mergeKey apre un passo nuovo', () => {
    store().apply('Testo', (d) => void (d.description = 'a'), 'desc')
    store().undo()
    store().redo()
    store().apply('Testo', (d) => void (d.description = 'ab'), 'desc')
    expect(store().past).toHaveLength(2)
  })

  it('la cronologia tiene al massimo 200 passi', () => {
    for (let i = 0; i < 205; i++) store().apply(`#${i}`, (d) => void (d.name = `n${i}`))
    expect(store().past).toHaveLength(200)
    expect(store().past[0]!.label).toBe('#5')
  })

  it('segna le modifiche non salvate finché non si salva', () => {
    expect(isDirty(store())).toBe(false)
    store().apply('A', (d) => void (d.name = 'A'))
    expect(isDirty(store())).toBe(true)
    store().markSaved('/tmp/prova.foru', store().revision)
    expect(isDirty(store())).toBe(false)
    store().undo()
    expect(isDirty(store())).toBe(true)
  })

  it('un progetto nuovo senza file risulta da salvare', () => {
    store().load(createEmptyProject('Senza file'), null)
    expect(isDirty(store())).toBe(true)
  })
})
