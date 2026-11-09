import type { ComponentProps, ReactNode } from 'react'
import { Circle, Shield, Swords, Trash2, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SceneTag } from '@shared/model'

export const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

/** Scorciatoia da tastiera (mono 10px, bordo line2). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('rounded-[4px] border border-line2 px-1 py-px font-mono text-[10px] font-medium text-tx3', className)}>
      {children}
    </span>
  )
}

type ToolbarButtonProps = ComponentProps<'button'> & {
  icon: LucideIcon
  kbd?: string
  variant?: 'default' | 'ghost' | 'outline' | 'primary'
}

export function ToolbarButton({ icon: Icon, kbd, variant = 'ghost', className, children, ...rest }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-7 items-center gap-[7px] rounded-md border px-2.5 text-[12.5px] font-medium whitespace-nowrap',
        variant === 'default' && 'border-line2 bg-raised text-tx hover:bg-hover',
        variant === 'ghost' && 'border-transparent text-tx2 hover:bg-hover hover:text-tx',
        variant === 'outline' && 'border-line2 text-tx2 hover:bg-hover hover:text-tx',
        variant === 'primary' && 'border-transparent bg-btn px-3 font-semibold text-btntx hover:opacity-90',
        className
      )}
      {...rest}
    >
      <Icon size={14} strokeWidth={2} />
      {children}
      {kbd && (variant === 'primary' ? <span className="font-mono text-[10px] opacity-60">{kbd}</span> : <Kbd>{kbd}</Kbd>)}
    </button>
  )
}

/** Pulsante di eliminazione ben visibile (scena, battuta, scelta): bordo e testo rossi, icona e testo esplicito. */
export function DangerButton({ icon: Icon = Trash2, className, children, ...rest }: ComponentProps<'button'> & { icon?: LucideIcon }) {
  return (
    <button
      type="button"
      className={cn('flex h-10 items-center justify-center gap-2 rounded-lg border border-err/60 bg-errbg px-5 text-[13px] font-semibold text-err hover:border-err hover:bg-err/20', className)}
      {...rest}
    >
      <Icon size={16} />
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, size = 14, className, ...rest }: ComponentProps<'button'> & { icon: LucideIcon; size?: number }) {
  return (
    <button
      type="button"
      className={cn('grid h-6 w-[26px] place-items-center rounded-[5px] text-tx2 hover:bg-hover hover:text-tx disabled:text-tx3 disabled:hover:bg-transparent', className)}
      {...rest}
    >
      <Icon size={size} />
    </button>
  )
}

export const TAG_META: Record<SceneTag, { label: string; icon: LucideIcon; fg: string; bg: string }> = {
  neutral: { label: 'NEUTRAL', icon: Circle, fg: 'text-neu', bg: 'bg-neubg' },
  safe: { label: 'SAFE', icon: Shield, fg: 'text-safe', bg: 'bg-safebg' },
  warning: { label: 'WARNING', icon: Swords, fg: 'text-warn', bg: 'bg-warnbg' }
}

/** Chip del tag: mai solo colore, sempre icona + etichetta. */
export function TagChip({ tag, size = 'node', hidden }: { tag: SceneTag; size?: 'node' | 'toolbar'; hidden?: boolean }) {
  const meta = TAG_META[tag]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[4px] px-1.5 font-mono font-semibold tracking-[.06em]',
        size === 'node' ? 'h-[18px] text-[9.5px] leading-none' : 'h-6 rounded-[5px] px-2 text-[10px]',
        hidden ? 'stripes border border-line2 text-tx3' : [meta.fg, meta.bg]
      )}
    >
      <Icon size={size === 'node' ? 9 : 10} strokeWidth={2.5} />
      {meta.label}
    </span>
  )
}

/** Etichetta di categoria: mono 10px/600 maiuscolo, spaziatura .1em. */
export function CategoryLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[10px] font-semibold tracking-[.1em] text-tx3 uppercase', className)}>{children}</span>
}
