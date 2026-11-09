import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { comboFor, comboFromEvent, useKbd } from '../../lib/commands'
import { useUiStore } from '../../store/ui'
import { IconButton, cn } from './primitives'

/**
 * Finestra di scheda centrata sopra il grafo: scrim, raggio 12, bordo line2, ombra.
 * Intestazione e piè fissi, corpo che scorre.
 */
export function Sheet({
  category,
  chips,
  title,
  subtitle,
  actions,
  footer,
  width,
  height,
  onClose,
  children,
  bodyClassName,
  level = 0
}: {
  category: ReactNode
  chips?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  width: number
  height: number
  onClose(): void
  children: ReactNode
  bodyClassName?: string
  /** Finestre sovrapposte (es. editor condizioni sopra una scheda). */
  level?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (comboFromEvent(e) === comboFor('closeSheet', useUiStore.getState().shortcuts)) {
        // Esc chiude solo la finestra più in alto.
        const sheets = document.querySelectorAll('[data-sheet-level]')
        const top = Math.max(...[...sheets].map((s) => Number((s as HTMLElement).dataset.sheetLevel)))
        if (top === level) {
          e.stopPropagation()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, level])

  const kbdClose = useKbd('closeSheet')
  return createPortal(
    <div className="fixed inset-x-0 top-9 bottom-0 grid place-items-center bg-[var(--scrim)]" style={{ zIndex: 50 + level * 10 }} onMouseDown={onClose}>
      <div
        data-sheet-level={level}
        className="flex max-h-[calc(100%-32px)] max-w-[calc(100%-32px)] flex-col overflow-hidden rounded-xl border border-line2 bg-panel shadow-[var(--shadow)]"
        style={{ width, height }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SheetHeader category={category} chips={chips} title={title} subtitle={subtitle} actions={actions} onClose={onClose} />
        <div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>
        <div className="flex h-10 flex-none items-center justify-between gap-3 border-t border-line px-5 font-mono text-[11px] text-tx3">
          {footer ?? <span />}
          {kbdClose ? <span>{kbdClose} chiudi</span> : <span />}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function SheetHeader({
  category,
  chips,
  title,
  subtitle,
  actions,
  onClose
}: {
  category: ReactNode
  chips?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Senza `onClose` non c'è il pulsante di chiusura (le schede del dock si chiudono dalla loro linguetta). */
  onClose?(): void
}) {
  const kbdClose = useKbd('closeSheet')
  return (
    <div className="flex flex-none flex-wrap items-start gap-x-3 gap-y-1 border-b border-line px-4 pt-4 pb-3.5 sm:px-5">
      <div className="flex min-w-[min(100%,13rem)] flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3 uppercase">{category}</span>
          {chips}
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <div className="min-w-0 flex-1 basis-40 text-[22px] font-semibold tracking-[-.01em]">{title}</div>
          {subtitle && <div className="truncate text-[12.5px] text-tx3">{subtitle}</div>}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {actions}
        {onClose && <IconButton icon={X} size={15} title={kbdClose ? `Chiudi (${kbdClose})` : 'Chiudi'} onClick={onClose} />}
      </div>
    </div>
  )
}

/** Sezione numerata "01 · ETICHETTA" separata da bordo line. */
export function Section({ n, label, right, children, className }: { n: number; label: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-2.5 border-b border-line pt-3.5 pb-4 last:border-b-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="font-mono text-[10px] font-semibold tracking-[.1em]">
          <span className="text-ac">{String(n).padStart(2, '0')}</span>
          <span className="text-tx3"> · {label.toUpperCase()}</span>
        </span>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Riga di elenco dentro una sezione (bordo, raggio 8). */
export function Row({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'warn' | 'ac' | 'final' }) {
  return (
    <div
      className={cn(
        'flex min-h-[38px] flex-wrap items-center gap-2 rounded-lg border border-line2 bg-raised px-2.5 py-1.5',
        tone === 'warn' && 'border-warn/60 bg-warnbg',
        tone === 'ac' && 'border-acln bg-acbg',
        className
      )}
    >
      {children}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line2 px-3 py-2.5 text-[12px] text-tx3">{children}</div>
}
