import { useEffect, useMemo, useRef, useState } from 'react'
import { ENTITY_ICON, useProject } from '../../lib/entities'
import { useKbd } from '../../lib/commands'
import { useCommand } from '../../lib/shortcuts'
import { openEntity, useUiStore } from '../../store/ui'
import { dockBridge } from '../../dock/bridge'
import { Kbd, TAG_META, cn } from '../ui/primitives'
import { SearchInput } from '../ui/SearchInput'
import { matchIndex } from '@shared/engine'
import { search, type SearchResult } from './search'

function Highlighted({ text, q }: { text: string; q: string }) {
  const i = matchIndex(text, q)
  const n = q.trim().length
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="bg-acbg text-tx">{text.slice(i, i + n)}</span>
      {text.slice(i + n)}
    </>
  )
}

/** Ricerca globale (1c): risultati per Scene e Catalogo, le scene trovate restano in evidenza nel grafo. */
export function SearchBox() {
  const p = useProject()
  const ui = useUiStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => search(p, q), [p, q])
  const scenes = results.filter((r) => r.type === 'scene')
  const catalog = results.filter((r) => r.type !== 'scene')
  const ordered = [...scenes, ...catalog]
  const kbd = useKbd('search')

  useCommand('search', () => {
    // Il campo sta nella barra del grafo: se davanti c'è un'altra scheda, prima si porta in vista il grafo.
    dockBridge.openPanel?.('graph')
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.select()
      setOpen(true)
    })
  })

  // Le scene corrispondenti si evidenziano mentre si scrive.
  useEffect(() => {
    if (!q.trim()) {
      if (ui.highlight?.label.startsWith('Ricerca')) ui.setHighlight(null)
      return
    }
    const ids = new Set(results.flatMap((r) => r.sceneIds))
    ui.setHighlight({ sceneIds: ids, label: `Ricerca: ${ids.size} scene corrispondono a «${q.trim()}»` })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, q])

  const pick = (r: SearchResult, inGraph: boolean) => {
    setOpen(false)
    input.current?.blur()
    if (inGraph && r.sceneIds[0]) ui.focusScene(r.sceneIds[0])
    else openEntity(r.type, r.id)
  }

  const clear = () => {
    setQ('')
    ui.setHighlight(null)
    setOpen(false)
    input.current?.blur()
  }

  const Row = ({ r, i }: { r: SearchResult; i: number }) => {
    const scene = r.type === 'scene' ? p.scenes.find((s) => s.id === r.id) : undefined
    const Icon = scene ? TAG_META[scene.tag].icon : ENTITY_ICON[r.type]
    return (
      <button
        type="button"
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => pick(r, e.shiftKey)}
        className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left', i === active && 'bg-acbg')}
      >
        {Icon && <Icon size={13} className={scene ? TAG_META[scene.tag].fg : 'text-tx2'} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            <Highlighted text={r.label} q={q.trim()} />
          </span>
          <span className="block truncate text-[11.5px] text-tx3">{r.snippet ? <Highlighted text={r.snippet} q={q.trim()} /> : r.sub}</span>
        </span>
        {i === active && <span className="font-mono text-[10px] text-tx3">Invio</span>}
      </button>
    )
  }

  return (
    <div className="relative">
      <SearchInput
        className="h-7 w-[340px]"
        inputRef={input}
        value={q}
        highlighted={open || !!q}
        onChange={(v) => {
          if (!v) return clear()
          setQ(v)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        // Tasti del campo (non comandi): frecce, Invio e Esc muovono e chiudono l'elenco dei risultati.
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, ordered.length - 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
          if (e.key === 'Enter' && ordered[active]) pick(ordered[active]!, e.shiftKey)
          if (e.key === 'Escape') (e.stopPropagation(), clear())
        }}
        placeholder="Cerca scene, NPC, oggetti, quest…"
        trailing={kbd && <Kbd>{kbd}</Kbd>}
      />
      {open && q.trim() && (
        <div className="absolute top-[34px] left-0 z-20 flex max-h-[520px] w-[420px] flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-line2 bg-raised p-1.5 shadow-[var(--shadow)]">
          <div className="flex justify-between px-2 pt-1.5 pb-1 font-mono text-[10px] font-semibold tracking-[.08em] text-tx3">
            <span>SCENE · {scenes.length}</span>
            <span>evidenziate nel grafo</span>
          </div>
          {scenes.map((r, i) => (
            <Row key={r.id} r={r} i={i} />
          ))}
          <div className="mt-1 border-t border-line px-2 pt-2 pb-1 font-mono text-[10px] font-semibold tracking-[.08em] text-tx3">CATALOGO · {catalog.length}</div>
          {catalog.map((r, i) => (
            <Row key={r.id} r={r} i={scenes.length + i} />
          ))}
          {ordered.length === 0 && <div className="px-2 py-2 text-tx3">Nessun risultato.</div>}
          <div className="mt-1 flex gap-3.5 border-t border-line px-2 pt-2 pb-1 font-mono text-[10.5px] text-tx3">
            <span>↑↓ naviga</span>
            <span>Invio apri</span>
            <span>Maiusc+Invio seleziona nel grafo</span>
            <span>Esc chiudi</span>
          </div>
        </div>
      )}
    </div>
  )
}
