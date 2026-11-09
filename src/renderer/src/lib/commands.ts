import { useUiStore } from '../store/ui'

// Registro dei comandi con scorciatoia. REGOLA: ogni nuovo comando da tastiera si aggiunge qui,
// così compare in Impostazioni › Scorciatoie, si può cambiare e viene salvato con le preferenze.

/** Dove vale il comando: due comandi nello stesso ambito (o uno globale) non possono avere la stessa combinazione. */
export type CommandScope = 'global' | 'graph' | 'dialog' | 'views' | 'sheet'

export interface CommandDef {
  id: string
  label: string
  group: string
  scope: CommandScope
  /** Combinazione predefinita, es. "ctrl+shift+s"; vuota = nessuna. */
  combo: string
}

const def = (group: string, scope: CommandScope, id: string, label: string, combo = ''): CommandDef => ({ id, label, group, scope, combo })

export const COMMANDS = [
  def('File', 'global', 'newProject', 'Nuovo progetto', 'ctrl+n'),
  def('File', 'global', 'openProject', 'Apri progetto', 'ctrl+o'),
  def('File', 'global', 'save', 'Salva', 'ctrl+s'),
  def('File', 'global', 'saveAs', 'Salva con nome', 'ctrl+shift+s'),
  def('File', 'global', 'export', 'Esporta', 'ctrl+shift+e'),
  def('Modifica', 'global', 'undo', 'Annulla', 'ctrl+z'),
  def('Modifica', 'global', 'redo', 'Ripeti', 'ctrl+y'),
  def('Modifica', 'global', 'redoAlt', 'Ripeti (alternativa)', 'ctrl+shift+z'),
  def('Grafo', 'graph', 'newScene', 'Nuova scena', 'n'),
  def('Grafo', 'graph', 'groupSelection', 'Raggruppa la selezione', 'g'),
  def('Grafo', 'graph', 'removeFromGroup', 'Rimuovi la selezione dal gruppo'),
  def('Grafo', 'graph', 'deleteSelection', 'Elimina la selezione (scene o collegamenti)', 'delete'),
  def('Grafo', 'graph', 'toggleSnap', 'Attiva o disattiva l’aggancio dei nodi'),
  def('Grafo', 'graph', 'fitView', 'Adatta il grafo alla finestra', 'ctrl+0'),
  def('Grafo', 'graph', 'clearHighlight', 'Togli l’evidenziazione', 'escape'),
  def('Vista', 'global', 'search', 'Cerca', 'ctrl+k'),
  def('Vista', 'global', 'toggleCatalog', 'Pannello catalogo', 'ctrl+b'),
  def('Vista', 'global', 'toggleValidation', 'Validazione', 'ctrl+shift+m'),
  def('Vista', 'global', 'crossProgress', 'Viste incrociate › Avanzamento', 'ctrl+shift+v'),
  def('Vista', 'global', 'documents', 'Documenti', 'ctrl+e'),
  def('Vista', 'global', 'dialogList', 'Elenco dei dialoghi', 'ctrl+shift+d'),
  def('Vista', 'global', 'toggleTheme', 'Cambia tema', 'ctrl+shift+t'),
  def('Playtest', 'global', 'playFromStart', 'Playtest dall’inizio', 'f5'),
  def('Playtest', 'global', 'playFromHere', 'Playtest dalla scena selezionata', 'shift+f5'),
  def('Dialoghi', 'dialog', 'newLine', 'Nuova battuta', 'b'),
  def('Dialoghi', 'dialog', 'newChoice', 'Nuova scelta', 's'),
  def('Layout', 'global', 'backToGraph', 'Porta in primo piano la scheda del grafo', ''),
  def('Layout', 'global', 'resetLayout', 'Layout standard', ''),
  def('Layout', 'global', 'togglePanelMaximize', 'Ingrandisci / ripristina la scheda attiva', 'ctrl+space'),
  def('Layout', 'global', 'popoutPanel', 'Stacca la scheda attiva in una finestra', ''),
  def('Layout', 'global', 'toggleLeftArea', 'Mostra / nascondi l’area sinistra', ''),
  def('Layout', 'global', 'toggleRightArea', 'Mostra / nascondi l’area destra', ''),
  def('Layout', 'global', 'toggleBottomArea', 'Mostra / nascondi l’area in basso', ''),
  def('Layout', 'global', 'openInspector', 'Scheda della scena / del gruppo', ''),
  def('Schermate', 'sheet', 'closeSheet', 'Chiudi la finestra aperta', 'escape')
] as const satisfies readonly CommandDef[]

export type CommandId = (typeof COMMANDS)[number]['id']

const byId = new Map<string, CommandDef>(COMMANDS.map((c) => [c.id, c]))

/** Combinazione in uso per il comando: personalizzata se presente, altrimenti predefinita. */
export function comboFor(id: CommandId, overrides: Record<string, string>): string {
  return id in overrides ? overrides[id]! : (byId.get(id)?.combo ?? '')
}

/** Comando che usa già la stessa combinazione in un ambito che si sovrappone. */
export function findConflict(id: string, combo: string, overrides: Record<string, string>): CommandDef | null {
  const me = byId.get(id)
  if (!me || !combo) return null
  return COMMANDS.find((c) => c.id !== id && comboFor(c.id, overrides) === combo && (c.scope === 'global' || me.scope === 'global' || c.scope === me.scope)) ?? null
}

const KEY_LABEL: Record<string, string> = { escape: 'Esc', ' ': 'Spazio', space: 'Spazio', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', delete: 'Canc', backspace: 'Backspace', enter: 'Invio', tab: 'Tab' }
const MOD_LABEL: Record<string, string> = { ctrl: 'Ctrl', shift: 'Maiusc', alt: 'Alt' }

/** "ctrl+shift+s" → "Ctrl Maiusc S". */
export function formatCombo(combo: string): string {
  if (!combo) return ''
  return combo
    .split('+')
    .map((p) => MOD_LABEL[p] ?? KEY_LABEL[p] ?? (p.length === 1 ? p.toUpperCase() : p.toUpperCase()))
    .join(' ')
}

/** Combinazione corrente di un comando (si aggiorna quando cambiano le preferenze). */
export function useCombo(id: CommandId): string {
  return useUiStore((s) => comboFor(id, s.shortcuts))
}

/** Etichetta della scorciatoia per mostrarla in menu e pulsanti ("" se non assegnata). */
export function useKbd(id: CommandId): string {
  return formatCombo(useCombo(id))
}

/** Come useKbd ma fuori da un componente (menu costruiti da funzioni). */
export function kbdLabel(id: CommandId): string {
  return formatCombo(comboFor(id, useUiStore.getState().shortcuts))
}

/** Combinazione premuta, nel formato dei comandi; null se è solo un modificatore. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase()
  if (['control', 'shift', 'alt', 'meta', 'altgraph'].includes(key)) return null
  return [e.ctrlKey && 'ctrl', e.shiftKey && 'shift', e.altKey && 'alt', key === ' ' ? 'space' : key].filter(Boolean).join('+')
}
