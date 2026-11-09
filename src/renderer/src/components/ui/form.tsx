import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from './primitives'

// Controlli di form densi (30–32px, raggio 6) nello stile del design.

const box = 'rounded-md border border-line2 bg-sunken text-tx outline-none placeholder:text-tx3 focus:border-ac focus:shadow-[0_0_0_3px_var(--acbg)]'

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="flex items-baseline justify-between gap-2 text-[11.5px] text-tx3">
        {label}
        {hint && <span className="font-mono text-[10px]">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** Campo di testo che salva al blur o con Invio: evita una voce di annulla per ogni tasto. */
export function TextInput({
  value,
  onCommit,
  className,
  ...rest
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onCommit(v: string): void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(value)
      }}
      className={cn(box, 'h-[30px] px-2.5', className)}
    />
  )
}

export function NumberInput({
  value,
  onCommit,
  min,
  className,
  allowNull
}: {
  value: number | null
  onCommit(v: number | null): void
  min?: number
  className?: string
  allowNull?: boolean
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  useEffect(() => setDraft(value === null ? '' : String(value)), [value])
  const commit = () => {
    if (draft.trim() === '' && allowNull) return value !== null && onCommit(null)
    const n = Number(draft.replace(',', '.'))
    if (Number.isFinite(n) && (min === undefined || n >= min)) {
      if (n !== value) onCommit(n)
    } else setDraft(value === null ? '' : String(value))
  }
  return (
    <input
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={cn(box, 'h-[30px] w-full px-2.5 font-mono text-[12px]', className)}
    />
  )
}

export function TextArea({ value, onCommit, rows = 4, className, placeholder }: { value: string; onCommit(v: string): void; rows?: number; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <textarea
      rows={rows}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      className={cn(box, 'resize-y px-2.5 py-2 leading-[1.55]', className)}
    />
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange(v: T): void
  className?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(box, 'h-[30px] px-2', className)}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange(v: boolean): void; label?: ReactNode; sub?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-2.5 text-left">
      {label && (
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-tx">{label}</span>
          {sub && <span className="block text-[11.5px] text-tx3">{sub}</span>}
        </span>
      )}
      <span className={cn('relative h-[18px] w-8 flex-none rounded-full border transition-colors', checked ? 'border-ac bg-ac' : 'border-line2 bg-sunken')}>
        <span className={cn('absolute top-[2px] size-3 rounded-full transition-all', checked ? 'left-[16px] bg-btntx' : 'left-[2px] bg-tx3')} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className
}: {
  value: T
  options: readonly (readonly [T, ReactNode])[]
  onChange(v: T): void
  className?: string
}) {
  return (
    <div className={cn('flex rounded-[7px] border border-line bg-sunken p-0.5 text-xs text-tx2', className)}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn('flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-[5px] px-1.5 py-1', value === v && 'bg-raised text-tx shadow-[0_1px_2px_rgba(0,0,0,.2)]')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Button({
  variant = 'outline',
  className,
  ...rest
}: ComponentProps<'button'> & { variant?: 'outline' | 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium whitespace-nowrap disabled:opacity-40',
        variant === 'outline' && 'border border-line2 text-tx hover:bg-hover',
        variant === 'primary' && 'bg-btn font-semibold text-btntx hover:opacity-90',
        variant === 'ghost' && 'text-tx2 hover:bg-hover hover:text-tx',
        variant === 'danger' && 'border border-err/40 text-err hover:bg-errbg',
        className
      )}
      {...rest}
    />
  )
}

/** Pulsante piccolo "+ Aggiungi" delle intestazioni di sezione. */
export function AddButton({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[11.5px] text-tx2 hover:bg-hover hover:text-tx">
      + {children}
    </button>
  )
}

/** Chiude al clic fuori dall'elemento. */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!active) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside()
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [onOutside, active])
  return ref
}
