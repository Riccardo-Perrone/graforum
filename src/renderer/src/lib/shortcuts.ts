import { useEffect, useRef } from 'react'
import { useUiStore } from '../store/ui'
import { comboFor, comboFromEvent, type CommandId } from './commands'

// Finestre staccate dal dock (schede in una finestra propria): le scorciatoie valgono anche lì.
const extraWindows = new Set<Window>()
const windowListeners = new Set<(w: Window, added: boolean) => void>()

/** Fa valere le scorciatoie anche nella finestra indicata; restituisce la funzione che le toglie. */
export function addShortcutWindow(w: Window): () => void {
  extraWindows.add(w)
  windowListeners.forEach((l) => l(w, true))
  return () => {
    extraWindows.delete(w)
    windowListeners.forEach((l) => l(w, false))
  }
}

/**
 * Scorciatoia da tastiera, es. "ctrl+s", "ctrl+shift+t", "n"; stringa vuota = disattivata.
 * Le scorciatoie senza modificatori non scattano mentre si scrive in un campo.
 */
export function useShortcut(combo: string, handler: () => void): void {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    if (!combo) return
    const onKey = (e: KeyboardEvent) => {
      if (comboFromEvent(e) !== combo.toLowerCase()) return
      const target = e.target as HTMLElement | null
      const typing = target?.closest?.('input, textarea, [contenteditable="true"]')
      if (typing && !e.ctrlKey) return
      e.preventDefault()
      ref.current()
    }
    const targets = new Set<Window>([window, ...extraWindows])
    for (const w of targets) w.addEventListener('keydown', onKey)
    const onWindow = (w: Window, added: boolean) => {
      if (added) {
        targets.add(w)
        w.addEventListener('keydown', onKey)
      } else {
        targets.delete(w)
        w.removeEventListener('keydown', onKey)
      }
    }
    windowListeners.add(onWindow)
    return () => {
      windowListeners.delete(onWindow)
      for (const w of targets) w.removeEventListener('keydown', onKey)
    }
  }, [combo])
}

/** Collega un comando del registro (lib/commands.ts) alla sua scorciatoia, modificabile dalle impostazioni. */
export function useCommand(id: CommandId, handler: () => void): void {
  const combo = useUiStore((s) => comboFor(id, s.shortcuts))
  useShortcut(combo, handler)
}
