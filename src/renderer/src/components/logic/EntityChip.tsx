import type { MouseEvent } from 'react'
import type { EntityType } from '@shared/model'
import { entityName } from '@shared/engine'
import { ENTITY_ICON, useProject } from '../../lib/entities'
import { openEntity, useUiStore } from '../../store/ui'
import { cn } from '../ui/primitives'

/**
 * Chip di entità: clic apre la scheda, Ctrl+clic la mostra nel grafo.
 * Gli enemy usano la tinta warn, gli altri l'accento.
 */
export function EntityChip({ type, id, className, label }: { type: EntityType; id: string; className?: string; label?: string }) {
  const p = useProject()
  const Icon = ENTITY_ICON[type]
  const onClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (e.ctrlKey) {
      const scene =
        type === 'scene'
          ? id
          : p.scenes.find((s) => s.npcs.some((n) => n.npcId === id) || s.items.some((i) => i.itemId === id) || s.encounterIds.includes(id))?.id
      if (scene) {
        useUiStore.getState().openSheet(null)
        useUiStore.getState().focusScene(scene)
      }
      return
    }
    openEntity(type, id)
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clic: apri la scheda · Ctrl+clic: mostra nel grafo"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap',
        type === 'enemy' || type === 'encounter' ? 'border-warn/40 bg-warnbg text-warn' : 'border-acln bg-acbg text-ac',
        'hover:brightness-125',
        className
      )}
    >
      {Icon && <Icon size={11} className="flex-none" />}
      <span className="truncate">{label ?? entityName(p, type, id)}</span>
    </button>
  )
}
