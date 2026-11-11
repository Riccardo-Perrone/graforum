import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'
import { Check, MoreHorizontal } from 'lucide-react'
import { IconButton, cn } from '../components/ui/primitives'
import { useCloseKey } from '../lib/shortcuts'
import { useUiStore } from '../store/ui'
import type { PanelId } from './bridge'
import { openPanelIn } from './layout'
import { PANEL_LIST } from './panelList'

/** Parametri di partenza delle schede che ne hanno bisogno quando si aprono dal menu. */
const startParams = (id: PanelId): Record<string, unknown> | undefined =>
  id === 'playtest' ? { startSceneId: null, nonce: Date.now() } : id === 'documents' ? { docId: null } : undefined

/** Menu "⋯" della linguetta, come in Unity: elenca tutte le schede e apre quella scelta in questo gruppo (portandola qui se è aperta altrove). */
export function PanelMenu({ api, group }: { api: DockviewApi; group: DockviewGroupPanel }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const button = useRef<HTMLDivElement>(null)
  const open = useUiStore((s) => s.openPanels)
  // In una finestra staccata il menu va disegnato nel documento di quella finestra.
  const doc = () => button.current?.ownerDocument ?? document

  useEffect(() => {
    if (!at) return
    const d = doc()
    const close = () => setAt(null)
    d.addEventListener('mousedown', close)
    return () => d.removeEventListener('mousedown', close)
  }, [at])
  useCloseKey(() => setAt(null), at !== null, doc)

  const choose = (id: PanelId) => {
    setAt(null)
    const existing = api.getPanel(id)
    if (!existing) return openPanelIn(api, id, startParams(id), group)
    if (existing.group.id !== group.id) existing.api.moveTo({ group })
    existing.api.setActive()
  }

  return (
    <div ref={button}>
      <IconButton
        icon={MoreHorizontal}
        size={13}
        className="size-6"
        title="Schede"
        onClick={() => {
          const r = button.current!.getBoundingClientRect()
          setAt(at ? null : { x: r.right, y: r.bottom + 2 })
        }}
      />
      {at &&
        createPortal(
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-[999] flex w-[200px] flex-col gap-0.5 rounded-lg border border-line2 bg-raised p-1.5 text-[12.5px] text-tx shadow-[var(--shadow)]"
            style={{ left: Math.max(8, at.x - 200), top: at.y }}
          >
            {PANEL_LIST.map(({ id, title }) => (
              <button key={id} type="button" onClick={() => choose(id)} className={cn('flex items-center justify-between rounded-[5px] px-2 py-1.5 text-left hover:bg-hover', group.panels.some((p) => p.id === id) && 'text-ac')}>
                {title}
                {open.includes(id) && <Check size={12} className="text-tx3" />}
              </button>
            ))}
          </div>,
          doc().body
        )}
    </div>
  )
}
