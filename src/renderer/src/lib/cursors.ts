import { useEffect } from 'react'

/** Mano chiusa su tutta la finestra mentre è premuto il tasto centrale del mouse (spostamento della vista). Listener in cattura: d3-zoom ferma la propagazione del mousedown. */
export function usePanCursor(): void {
  useEffect(() => {
    const down = (e: MouseEvent) => e.button === 1 && document.body.classList.add('is-panning')
    const up = (e: MouseEvent) => e.button === 1 && document.body.classList.remove('is-panning')
    const clear = () => document.body.classList.remove('is-panning')
    window.addEventListener('mousedown', down, true)
    window.addEventListener('mouseup', up, true)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('mousedown', down, true)
      window.removeEventListener('mouseup', up, true)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [])
}
