import { describe, expect, it } from 'vitest'
import { COMMANDS, comboFor, comboFromEvent, commandScope, findConflict, formatCombo } from './commands'

const key = (k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey'>> = {}) =>
  ({ key: k, ctrlKey: false, shiftKey: false, altKey: false, ...mods }) as KeyboardEvent

describe('registro dei comandi', () => {
  it('ogni comando ha un id unico, etichetta e gruppo', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of COMMANDS) {
      expect(c.label.trim(), c.id).not.toBe('')
      expect(c.group.trim(), c.id).not.toBe('')
    }
  })

  it('le combinazioni predefinite non sono in conflitto tra loro', () => {
    const conflicts = COMMANDS.filter((c) => c.combo).flatMap((c) => {
      const other = findConflict(c.id, c.combo, {})
      return other ? [`${c.id} ↔ ${other.id} (${c.combo})`] : []
    })
    expect(conflicts).toEqual([])
  })

  it('le combinazioni predefinite sono scritte in minuscolo nel formato di comboFromEvent', () => {
    for (const c of COMMANDS.filter((x) => x.combo)) expect(c.combo, c.id).toMatch(/^((ctrl|shift|alt)\+)*[a-z0-9]+$/)
  })
})

describe('combinazioni', () => {
  it('quella personalizzata vince sulla predefinita, anche se vuota', () => {
    expect(comboFor('save', {})).toBe('ctrl+s')
    expect(comboFor('save', { save: 'ctrl+alt+s' })).toBe('ctrl+alt+s')
    expect(comboFor('save', { save: '' })).toBe('')
  })

  it('trova il conflitto con un comando globale o dello stesso ambito, non tra ambiti diversi', () => {
    expect(findConflict('newScene', 'ctrl+s', {})?.id).toBe('save')
    expect(findConflict('newLine', 'n', {})).toBeNull() // dialoghi vs grafo
    expect(findConflict('groupSelection', 'n', {})?.id).toBe('newScene')
    // Esc chiude le finestre (ambito sheet) e toglie l'evidenziazione (ambito grafo): ambiti separati.
    expect(findConflict('clearHighlight', 'escape', {})).toBeNull()
    expect(findConflict('save', '', {})).toBeNull()
  })

  it('tiene conto delle combinazioni personalizzate', () => {
    expect(findConflict('newScene', 'ctrl+s', { save: 'ctrl+alt+s' })).toBeNull()
  })

  it('mostra le combinazioni in italiano', () => {
    expect(formatCombo('ctrl+shift+s')).toBe('Ctrl Maiusc S')
    expect(formatCombo('escape')).toBe('Esc')
    expect(formatCombo('ctrl+space')).toBe('Ctrl Spazio')
    expect(formatCombo('delete')).toBe('Canc')
    expect(formatCombo('f5')).toBe('F5')
    expect(formatCombo('')).toBe('')
  })

  it('legge la combinazione premuta, ignorando i soli modificatori', () => {
    expect(comboFromEvent(key('S', { ctrlKey: true, shiftKey: true }))).toBe('ctrl+shift+s')
    expect(comboFromEvent(key(' ', { ctrlKey: true }))).toBe('ctrl+space')
    expect(comboFromEvent(key('Escape'))).toBe('escape')
    expect(comboFromEvent(key('Control', { ctrlKey: true }))).toBeNull()
    expect(comboFromEvent(key('Shift', { shiftKey: true }))).toBeNull()
  })

  it('conosce l’ambito di ogni comando', () => {
    expect(commandScope('newScene')).toBe('graph')
    expect(commandScope('newLine')).toBe('dialog')
    expect(commandScope('save')).toBe('global')
  })
})
