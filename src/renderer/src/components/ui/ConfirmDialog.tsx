import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert } from 'lucide-react'
import { create } from 'zustand'
import { comboFor, comboFromEvent, useKbd, type CommandId } from '../../lib/commands'
import { useUiStore } from '../../store/ui'
import { cn } from './primitives'

interface ConfirmOptions {
  title: string
  /** Dettagli sotto il titolo (una riga per voce). */
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Pulsante di conferma rosso (default: sì). */
  danger?: boolean
  /** Comando che, premuto di nuovo mentre la conferma è aperta, la conferma (es. Canc per l'eliminazione). */
  confirmCommand?: CommandId
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve(ok: boolean): void }) | null
}

const useConfirmStore = create<ConfirmState>(() => ({ request: null }))

/** Chiede conferma con la modale dell'app (al posto di window.confirm). Risolve true solo se confermata. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // Una sola conferma alla volta: la precedente, se ancora aperta, viene annullata.
    useConfirmStore.getState().request?.resolve(false)
    useConfirmStore.setState({
      request: {
        ...options,
        resolve: (ok) => {
          useConfirmStore.setState({ request: null })
          resolve(ok)
        }
      }
    })
  })
}

/** C'è una conferma aperta? Le scorciatoie che ne aprirebbero un'altra devono aspettare. */
export const isConfirmOpen = (): boolean => useConfirmStore.getState().request !== null

/** Da montare una sola volta, in App. */
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const kbdClose = useKbd('closeSheet')
  const kbdConfirm = useKbd(request?.confirmCommand ?? 'closeSheet')

  useEffect(() => {
    if (!request) return
    cancelRef.current?.focus()
    // In fase di cattura: Esc annulla la conferma e non chiude la scheda sotto.
    const onKey = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e)
      const shortcuts = useUiStore.getState().shortcuts
      if (combo === comboFor('closeSheet', shortcuts)) {
        e.stopPropagation()
        e.preventDefault()
        request.resolve(false)
      } else if (request.confirmCommand && combo && combo === comboFor(request.confirmCommand, shortcuts)) {
        e.stopImmediatePropagation()
        e.preventDefault()
        request.resolve(true)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [request])

  if (!request) return null
  const danger = request.danger ?? true
  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[var(--scrim)]" onMouseDown={() => request.resolve(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={request.title}
        className="flex w-[420px] max-w-[calc(100%-32px)] flex-col gap-4 rounded-xl border border-line2 bg-panel p-5 shadow-[var(--shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <span className={cn('grid h-9 w-9 flex-none place-items-center rounded-lg', danger ? 'bg-errbg text-err' : 'bg-acbg text-ac')}>
            <TriangleAlert size={18} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="text-[15px] font-semibold break-words">{request.title}</div>
            {request.detail && <div className="text-[12.5px] whitespace-pre-line text-tx2">{request.detail}</div>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          {kbdClose && <span className="mr-auto font-mono text-[10.5px] text-tx3">{kbdClose} annulla</span>}
          <button
            ref={cancelRef}
            type="button"
            className="h-8 rounded-md border border-line2 px-3.5 text-[12.5px] font-medium text-tx2 hover:bg-hover hover:text-tx"
            onClick={() => request.resolve(false)}
          >
            {request.cancelLabel ?? 'Annulla'}
          </button>
          <button
            type="button"
            className={cn(
              'h-8 rounded-md border px-3.5 text-[12.5px] font-semibold',
              danger ? 'border-err/60 bg-errbg text-err hover:border-err hover:bg-err/20' : 'border-transparent bg-btn text-btntx hover:opacity-90'
            )}
            onClick={() => request.resolve(true)}
          >
            {request.confirmLabel ?? 'Elimina'}
            {request.confirmCommand && kbdConfirm && <span className="ml-2 font-mono text-[10px] font-medium opacity-70">{kbdConfirm}</span>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
