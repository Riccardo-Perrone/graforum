import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Search } from 'lucide-react'
import { filterDialogs, listDialogEntries, type DialogSummary } from '@shared/engine'
import { Combobox } from '../components/ui/Combobox'
import { Segmented } from '../components/ui/form'
import { ToolbarButton } from '../components/ui/primitives'
import { useProject } from '../lib/entities'
import { useCommand } from '../lib/shortcuts'
import { openEntity, useUiStore } from '../store/ui'

// Vista "Dialoghi": i dialoghi principali del progetto, filtrabili per NPC, scena e contenuto, raggruppabili per NPC o scena.

const SEARCH_DELAY_MS = 250
const NO_GROUP = '__none'

export function DialogsListView() {
  const p = useProject()
  const ui = useUiStore()
  const { npcId, sceneId, query, groupBy } = ui.dialogList
  const [draft, setDraft] = useState(query)

  // La ricerca si applica da sola poco dopo l'ultimo tasto.
  useEffect(() => {
    if (draft === query) return
    const t = window.setTimeout(() => ui.setDialogList({ query: draft }), SEARCH_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [draft, query, ui])

  const entries = useMemo(() => listDialogEntries(p), [p])
  const shown = useMemo(() => filterDialogs(p, entries, { npcId, sceneId, query }), [p, entries, npcId, sceneId, query])
  const sceneTitle = (id: string) => p.scenes.find((s) => s.id === id)?.title ?? id
  const npcName = (id: string) => p.npcs.find((n) => n.id === id)?.name ?? '—'

  // Un dialogo assegnato a più scene compare in ciascuna; senza scena finisce in "Senza scena".
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: NO_GROUP, title: '', items: shown }]
    const map = new Map<string, DialogSummary[]>()
    for (const d of shown) {
      const keys = groupBy === 'npc' ? [d.npcId] : d.sceneIds.length ? d.sceneIds : ['']
      for (const k of keys) map.set(k, [...(map.get(k) ?? []), d])
    }
    const title = (k: string) => (groupBy === 'npc' ? npcName(k) : k ? sceneTitle(k) : 'Senza scena')
    return [...map].map(([key, items]) => ({ key, title: title(key), items })).sort((a, b) => a.title.localeCompare(b.title))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, groupBy, p])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-panel px-3 py-1">
        <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">DIALOGHI</span>
        <span className="mx-1 h-5 w-px bg-line2" />
        <Combobox
          className="h-7 w-[190px]"
          allowClear
          value={npcId}
          placeholder="Tutti gli NPC"
          options={p.npcs.map((n) => ({ id: n.id, label: n.name }))}
          onChange={(v) => ui.setDialogList({ npcId: v })}
        />
        <Combobox
          className="h-7 w-[210px]"
          allowClear
          value={sceneId}
          placeholder="Tutte le scene"
          options={p.scenes.map((s) => ({ id: s.id, label: s.title }))}
          onChange={(v) => ui.setDialogList({ sceneId: v })}
        />
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute top-[8px] left-2 text-tx3" />
          <input
            className="h-7 w-[260px] rounded-md border border-line bg-sunken pr-2 pl-7 text-tx outline-none focus:border-ac"
            placeholder="Cerca nel contenuto…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <span className="flex-1" />
        <span className="text-tx3">Raggruppa per</span>
        <Segmented
          className="w-[210px]"
          value={groupBy}
          options={[
            ['none', 'Nessuno'],
            ['npc', 'NPC'],
            ['scene', 'Scene']
          ]}
          onChange={(v) => ui.setDialogList({ groupBy: v })}
        />
        <span className="w-[70px] text-right text-tx3">
          {shown.length} di {p.dialogs.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" data-text-scale>
        <div className="mx-auto flex max-w-[920px] flex-col gap-4">
          {groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-1.5">
              {g.title && <h3 className="px-1 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3 uppercase">{g.title} · {g.items.length}</h3>}
              {g.items.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openEntity('dialog', d.id)}
                  className="flex flex-col gap-1 rounded-lg border border-line bg-panel px-3 py-2 text-left hover:bg-hover"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={13} className="flex-none text-ac" />
                    <span className="font-semibold">{d.title}</span>
                    <span className="text-[11px] text-tx3">{d.lineCount} battute</span>
                  </div>
                  <div className="truncate text-[11px] text-tx3">
                    NPC: {npcName(d.npcId)}
                    {d.sceneIds.length > 0 && ` · Scene: ${d.sceneIds.map(sceneTitle).join(', ')}`}
                  </div>
                  {d.matches.slice(0, 3).map((m) => (
                    <span key={m.id} className="truncate border-l-2 border-line2 pl-2 text-tx2">
                      <span className="text-tx3">{m.speaker}: </span>
                      {m.text}
                    </span>
                  ))}
                  {d.matches.length > 3 && <span className="text-[11px] text-tx3">+{d.matches.length - 3} altre corrispondenze</span>}
                </button>
              ))}
            </section>
          ))}
          {shown.length === 0 && <span className="px-2 text-tx3">Nessun dialogo corrisponde ai filtri.</span>}
        </div>
      </div>
    </div>
  )
}
