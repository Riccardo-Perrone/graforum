import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from './primitives'

export interface ComboOption {
  id: string
  label: string
  sub?: string
  icon?: ReactNode
}

/**
 * Selettore con ricerca (6b): l'entità si sceglie da un elenco filtrabile,
 * con "Crea … nel catalogo" in fondo quando serve.
 */
export function Combobox({
  value,
  options,
  onChange,
  placeholder = 'Scegli…',
  onCreate,
  createLabel = 'nel catalogo',
  className,
  allowClear,
  icon
}: {
  value: string | null
  options: ComboOption[]
  onChange(id: string | null): void
  placeholder?: string
  onCreate?(name: string): string | void
  createLabel?: string
  className?: string
  allowClear?: boolean
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const selected = options.find((o) => o.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q)) : options
  }, [options, query])

  useLayoutEffect(() => {
    if (open && trigger.current) setRect(trigger.current.getBoundingClientRect())
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }
  const pick = (id: string | null) => {
    onChange(id)
    close()
  }
  const create = () => {
    const id = onCreate?.(query.trim())
    if (id) onChange(id)
    close()
  }

  const width = Math.max(rect?.width ?? 0, 280)
  const below = rect ? window.innerHeight - rect.bottom > 300 : true

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-[30px] min-w-0 items-center gap-2 rounded-md border border-line2 bg-sunken px-2.5 text-left hover:border-acln',
          open && 'border-ac shadow-[0_0_0_3px_var(--acbg)]',
          className
        )}
      >
        {icon ?? selected?.icon}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-tx3')}>{selected?.label ?? (value ? '(eliminato)' : placeholder)}</span>
        <ChevronDown size={13} className="flex-none text-tx3" />
      </button>
      {open &&
        rect &&
        createPortal(
          <div className="fixed inset-0 z-[100]" onMouseDown={close}>
            <div
              className="absolute flex max-h-[320px] flex-col rounded-[10px] border border-line2 bg-raised p-1.5 shadow-[var(--shadow)]"
              style={{ left: Math.min(rect.left, window.innerWidth - width - 8), width, ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }) }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <label className="mb-1 flex h-[30px] flex-none items-center gap-2 rounded-md border border-line2 bg-sunken px-2.5">
                <Search size={13} className="text-tx3" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, filtered.length - 1))
                    if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
                    if (e.key === 'Enter') {
                      const o = filtered[active]
                      if (o) pick(o.id)
                      else if (onCreate && query.trim()) create()
                    }
                    if (e.key === 'Escape') {
                      // Esc chiude solo il menu, non la finestra sottostante.
                      e.stopPropagation()
                      close()
                    }
                  }}
                  placeholder="Cerca…"
                  className="min-w-0 flex-1 bg-transparent text-tx outline-none placeholder:text-tx3"
                />
              </label>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {allowClear && (
                  <button type="button" onClick={() => pick(null)} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-tx3 hover:bg-hover">
                    Nessuno
                  </button>
                )}
                {filtered.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.id)}
                    className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left', i === active && 'bg-acbg', o.id === value && 'text-ac')}
                  >
                    {o.icon}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.sub && <span className="max-w-[45%] truncate font-mono text-[10.5px] text-tx3">{o.sub}</span>}
                  </button>
                ))}
                {filtered.length === 0 && !onCreate && <div className="px-2 py-2 text-tx3">Nessun risultato</div>}
              </div>
              {onCreate && (
                <button
                  type="button"
                  onClick={create}
                  className="mt-1 flex flex-none items-center gap-2 rounded-md border-t border-line px-2 pt-2 pb-1 text-left text-tx2 hover:text-tx"
                >
                  <Plus size={13} />
                  Crea {query.trim() ? `“${query.trim()}”` : 'nuovo'} {createLabel}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
