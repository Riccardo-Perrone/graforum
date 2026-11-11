import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from './primitives'

/**
 * Campo di ricerca dell'app: lente, testo, pulsante per svuotare. Il filtro si applica mentre si scrive.
 * Il confronto dei risultati va fatto con `matchesQuery` / `matchIndex` (`@shared/engine`), così tutte le ricerche si comportano allo stesso modo.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Cerca…',
  className,
  inputRef,
  autoFocus,
  highlighted,
  trailing,
  onKeyDown,
  onFocus,
  onBlur
}: {
  value: string
  onChange(value: string): void
  placeholder?: string
  /** Classi del contenitore (larghezza, altezza, margini). */
  className?: string
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  /** Bordo evidenziato anche senza fuoco (es. menu dei risultati aperto). */
  highlighted?: boolean
  /** Contenuto a destra quando il campo è vuoto (es. la scorciatoia). */
  trailing?: ReactNode
  onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void
  onFocus?(): void
  onBlur?(): void
}) {
  return (
    <label
      className={cn(
        'flex h-[30px] min-w-0 items-center gap-2 rounded-md border bg-sunken pr-2 pl-2.5 text-tx3 focus-within:border-ac',
        highlighted ? 'border-ac shadow-[0_0_0_3px_var(--acbg)]' : 'border-line2',
        className
      )}
    >
      <Search size={13} className="flex-none" />
      <input
        ref={inputRef}
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-tx outline-none placeholder:text-tx3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          title="Svuota"
          // mousedown: il campo non perde il fuoco prima del clic.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange('')}
          className="flex-none text-tx3 hover:text-tx"
        >
          <X size={13} />
        </button>
      ) : (
        trailing
      )}
    </label>
  )
}
