import { useMemo, useState, type ReactNode } from 'react'
import { Highlighter } from 'lucide-react'
import type { EntityType } from '@shared/model'
import { decisivePath, describeCondition, effectSites, entityName, leaves, progressRows, sourcesOf, type ProgressKind } from '@shared/engine'
import { getProject, options, useProject } from '../../lib/entities'
import { openEntity, useUiStore, type CrossTab } from '../../store/ui'
import { questScenes } from '../catalog/CatalogSheet'
import { EntityChip } from '../logic/EntityChip'
import { Combobox } from '../ui/Combobox'
import { Button, Toggle } from '../ui/form'
import { cn } from '../ui/primitives'
import { Empty, Sheet } from '../ui/Sheet'

// Viste incrociate (6d): dove serve un oggetto, quest nel grafo, avanzamento, NPC, enemy.

const TABS: [CrossTab, string][] = [
  ['item', 'Dove serve un oggetto'],
  ['quest', 'Quest nel grafo'],
  ['npc', 'NPC'],
  ['enemy', 'Enemy'],
  ['progress', 'Avanzamento']
]

const KIND_LABEL: Record<ProgressKind, string> = { condition: 'Condizione', effect: 'Effetto', check: 'Prova' }
const KIND_COLOR: Record<ProgressKind, string> = { condition: 'text-ac', effect: 'text-safe', check: 'text-tx' }

interface Row {
  key: string
  sceneId: string | null
  cols: ReactNode[]
  target: { type: EntityType; id: string }
}

/** Tabella densa: clic illumina il nodo dietro, doppio clic chiude e centra. */
function Table({ head, rows, widths }: { head: string[]; rows: Row[]; widths: string }) {
  const ui = useUiStore()
  const [sel, setSel] = useState<string | null>(null)
  if (rows.length === 0) return <Empty>Nessun elemento.</Empty>
  return (
    <div className="overflow-hidden rounded-lg border border-line2">
      <div className="grid gap-3 border-b border-line bg-sunken px-3 py-2 font-mono text-[10px] tracking-[.06em] text-tx3" style={{ gridTemplateColumns: widths }}>
        {head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.key}
          onClick={() => {
            setSel(r.key)
            if (r.sceneId) ui.setHighlight({ sceneIds: new Set([r.sceneId]), label: entityName(getProject(), 'scene', r.sceneId) })
          }}
          onDoubleClick={() => {
            ui.openSheet(null)
            if (r.sceneId) (ui.setHighlight(null), ui.focusScene(r.sceneId))
            else openEntity(r.target.type, r.target.id)
          }}
          className={cn('grid cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-[12.5px] last:border-b-0 hover:bg-hover', sel === r.key && 'bg-acbg')}
          style={{ gridTemplateColumns: widths }}
        >
          {r.cols.map((c, i) => (
            <div key={i} className="min-w-0 truncate">
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ItemView({ id }: { id: string | null }) {
  const p = useProject()
  const rows = useMemo((): Row[] => {
    if (!id) return []
    const out: Row[] = []
    for (const s of p.scenes)
      for (const i of s.items)
        if (i.itemId === id) out.push({ key: `in-${i.id}`, sceneId: s.id, target: { type: 'scene', id: s.id }, cols: [<b key="a" className="text-tx2">Si trova</b>, s.title, i.gate.condition ? describeCondition(p, i.gate.condition) : 'sempre'] })
    for (const n of p.npcs)
      for (const e of n.services.shop)
        if (e.itemId === id) out.push({ key: `shop-${n.id}`, sceneId: p.scenes.find((s) => s.npcs.some((x) => x.npcId === n.id))?.id ?? null, target: { type: 'npc', id: n.id }, cols: [<b key="a" className="text-tx2">In vendita</b>, n.name, `${e.price} × valuta`] })
    for (const site of effectSites(p)) {
      if ((site.effect.type === 'gainItem' || site.effect.type === 'loseItem') && site.effect.itemId === id && site.where !== 'oggetto presente' && site.where !== 'negozio') {
        const sceneId = site.type === 'scene' ? site.id : site.type === 'link' ? (p.links.find((l) => l.id === site.id)?.fromSceneId ?? null) : null
        out.push({ key: `fx-${out.length}`, sceneId, target: { type: site.type, id: site.id }, cols: [<b key="a" className={site.effect.type === 'gainItem' ? 'text-safe' : 'text-err'}>{site.effect.type === 'gainItem' ? 'Chi lo dà' : 'Dove si perde'}</b>, site.label, site.where] })
      }
    }
    for (const r of progressRows(p))
      if (r.kind === 'condition' && r.detail.includes(entityName(p, 'item', id)))
        out.push({ key: `need-${out.length}`, sceneId: r.sceneId, target: r.owner, cols: [<b key="a" className="text-ac">Dove serve</b>, `${entityName(p, 'scene', r.sceneId)} · ${r.element}`, r.detail] })
    return out
  }, [p, id])
  return <Table head={['RUOLO', 'DOVE', 'DETTAGLIO']} widths="130px 1fr 1.4fr" rows={rows} />
}

function QuestView({ id }: { id: string | null }) {
  const p = useProject()
  const quest = p.quests.find((q) => q.id === id)
  const rows = useMemo((): Row[] => {
    if (!quest) return []
    const out: Row[] = []
    const sites = effectSites(p)
    for (const s of sites)
      if ('questId' in s.effect && s.effect.questId === quest.id) {
        const sceneId = s.type === 'scene' ? s.id : s.type === 'link' ? (p.links.find((l) => l.id === s.id)?.fromSceneId ?? null) : null
        out.push({ key: `fx-${out.length}`, sceneId, target: { type: s.type, id: s.id }, cols: [<b key="a" className="text-safe">{s.effect.type === 'questStart' ? 'Chi la assegna' : 'Avanza'}</b>, s.label, s.where] })
      }
    quest.steps.forEach((st, i) =>
      leaves(st.requirements).forEach((leaf) =>
        sourcesOf(p, leaf, sites)
          .filter((x) => x.type !== 'project')
          .forEach((src) => out.push({ key: `st-${out.length}`, sceneId: null, target: { type: src.type, id: src.id }, cols: [<b key="a" className="text-tx2">Step {i + 1}</b>, st.title, `${describeCondition(p, leaf)} ← ${src.label}`] }))
      )
    )
    for (const r of progressRows(p))
      if (r.kind === 'condition' && r.detail.includes(quest.title))
        out.push({ key: `req-${out.length}`, sceneId: r.sceneId, target: r.owner, cols: [<b key="a" className="text-ac">Cosa sblocca</b>, `${entityName(p, 'scene', r.sceneId)} · ${r.element}`, r.detail] })
    return out
  }, [p, quest])
  if (!quest) return <Empty>Scegli una quest.</Empty>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-tx3">
        Scene toccate:
        {questScenes(p, quest.id).map((s) => (
          <EntityChip key={s} type="scene" id={s} />
        ))}
      </div>
      <Table head={['RUOLO', 'DOVE', 'DETTAGLIO']} widths="130px 1fr 1.4fr" rows={rows} />
    </div>
  )
}

function OwnerView({ type, id }: { type: 'npc' | 'enemy'; id: string | null }) {
  const p = useProject()
  const rows = useMemo((): Row[] => {
    if (!id) return []
    const out: Row[] = []
    if (type === 'npc') {
      for (const s of p.scenes)
        for (const pres of s.npcs)
          if (pres.npcId === id)
            out.push({
              key: s.id,
              sceneId: s.id,
              target: { type: 'scene', id: s.id },
              cols: [s.title, s.groupId ? entityName(p, 'group', s.groupId) : '—', pres.dialogs.map((d) => entityName(p, 'dialog', d.dialogId)).join(', ') || 'nessun dialogo']
            })
      for (const d of p.dialogs.filter((x) => x.npcId === id))
        if (!out.some((r) => String(r.cols[2]).includes(d.title))) out.push({ key: d.id, sceneId: null, target: { type: 'dialog', id: d.id }, cols: ['(non assegnato)', '—', d.title] })
    } else {
      for (const e of p.encounters.filter((x) => x.enemies.some((y) => y.enemyId === id))) {
        const scenes = p.scenes.filter((s) => s.encounterIds.includes(e.id))
        const qty = e.enemies.filter((x) => x.enemyId === id).reduce((n, x) => n + x.quantity, 0)
        if (scenes.length === 0) out.push({ key: e.id, sceneId: null, target: { type: 'encounter', id: e.id }, cols: ['(nessuna scena)', e.name, `${qty} × · ${e.nature === 'repeatable' ? 'ripetibile' : 'unico'}`] })
        for (const s of scenes) out.push({ key: `${e.id}-${s.id}`, sceneId: s.id, target: { type: 'scene', id: s.id }, cols: [s.title, e.name, `${qty} × · ${e.nature === 'repeatable' ? 'ripetibile' : 'unico'}`] })
      }
    }
    return out
  }, [p, type, id])
  return <Table head={type === 'npc' ? ['SCENA', 'GRUPPO', 'DIALOGHI'] : ['SCENA', 'INCONTRO', 'DETTAGLIO']} widths="1fr 1fr 1.4fr" rows={rows} />
}

function ProgressView({ scopeSceneId, onlyPath: initialOnlyPath }: { scopeSceneId: string | null; onlyPath: boolean }) {
  const p = useProject()
  const ui = useUiStore()
  const [kinds, setKinds] = useState<ProgressKind[]>(['condition', 'effect', 'check'])
  const [scope, setScope] = useState<string | null>(scopeSceneId)
  const [groupScope, setGroupScope] = useState<string | null>(null)
  const [onlyPath, setOnlyPath] = useState(initialOnlyPath)
  const pathEnding = ui.pathEndingId ?? p.endings[0]?.id ?? null
  const path = useMemo(() => (pathEnding ? decisivePath(p, pathEnding) : null), [p, pathEnding])
  const all = useMemo(() => progressRows(p), [p])
  const inGroup = (sceneId: string) => {
    if (!groupScope) return true
    let g = p.groups.find((x) => x.id === p.scenes.find((s) => s.id === sceneId)?.groupId)
    while (g) {
      if (g.id === groupScope) return true
      g = p.groups.find((x) => x.id === g!.parentId)
    }
    return false
  }
  const rows = all.filter((r) => kinds.includes(r.kind) && (!scope || r.sceneId === scope) && inGroup(r.sceneId) && (!onlyPath || path?.sceneIds.has(r.sceneId)))
  const highlightAll = () => {
    ui.setHighlight({ sceneIds: new Set(rows.map((r) => r.sceneId)), label: `Avanzamento: ${new Set(rows.map((r) => r.sceneId)).size} scene` })
    ui.openSheet(null)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['condition', 'effect', 'check'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}
            className={cn('h-7 rounded-md border px-2.5 text-[12px]', kinds.includes(k) ? 'border-acln bg-acbg text-ac' : 'border-line2 text-tx3')}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line2" />
        <Combobox className="w-[200px]" allowClear placeholder="Tutte le scene" value={scope} options={options(p, 'scene')} onChange={setScope} />
        <Combobox className="w-[200px]" allowClear placeholder="Tutti i gruppi" value={groupScope} options={options(p, 'group')} onChange={setGroupScope} />
        {path && (
          <div className="w-[150px]">
            <Toggle checked={onlyPath} onChange={setOnlyPath} label="Solo percorso" />
          </div>
        )}
        <span className="flex-1" />
        <Button onClick={highlightAll}>
          <Highlighter size={13} />
          Evidenzia risultati nel grafo
        </Button>
      </div>
      <Table
        head={['#', 'SCENA', 'TIPO', 'ELEMENTO', 'DETTAGLIO']}
        widths="40px 1fr 100px 1.2fr 1.6fr"
        rows={rows.map((r, i) => ({
          key: `${i}`,
          sceneId: r.sceneId,
          target: r.owner,
          cols: [
            <span key="n" className="font-mono text-tx3">{String(i + 1).padStart(2, '0')}</span>,
            entityName(p, 'scene', r.sceneId),
            <span key="k" className={KIND_COLOR[r.kind]}>{KIND_LABEL[r.kind]}</span>,
            r.element,
            <span key="d" className="text-tx2">{r.detail}</span>
          ]
        }))}
      />
      <span className="font-mono text-[11px] text-tx3">{rows.length} righe · ordinate per distanza dalla partenza · doppio clic apre nel grafo</span>
    </div>
  )
}

export function CrossViews({ tab, entityId, scopeSceneId, onlyPath }: { tab: CrossTab; entityId?: string | null; scopeSceneId?: string | null; onlyPath?: boolean }) {
  const p = useProject()
  const ui = useUiStore()
  const [ids, setIds] = useState<Record<string, string | null>>({
    item: tab === 'item' ? (entityId ?? p.items[0]?.id ?? null) : (p.items[0]?.id ?? null),
    quest: tab === 'quest' ? (entityId ?? p.quests[0]?.id ?? null) : (p.quests[0]?.id ?? null),
    npc: tab === 'npc' ? (entityId ?? p.npcs[0]?.id ?? null) : (p.npcs[0]?.id ?? null),
    enemy: tab === 'enemy' ? (entityId ?? p.enemies[0]?.id ?? null) : (p.enemies[0]?.id ?? null)
  })
  const pick = (t: 'item' | 'quest' | 'npc' | 'enemy') => (
    <Combobox className="w-[280px]" value={ids[t] ?? null} options={options(p, t)} onChange={(id) => setIds({ ...ids, [t]: id })} />
  )
  return (
    <Sheet
      category="Viste incrociate"
      title={TABS.find(([t]) => t === tab)![1]}
      subtitle="Ctrl Maiusc V"
      width={1320}
      height={900}
      onClose={() => ui.openSheet(null)}
      footer={<span>Clic: illumina il nodo · Doppio clic: chiude e centra</span>}
    >
      <div className="flex flex-col gap-4 p-5" data-text-scale>
        <div className="flex gap-1 border-b border-line">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => ui.openSheet({ kind: 'cross', tab: t })}
              className={cn('-mb-px border-b-2 px-3 py-2 text-[12.5px]', t === tab ? 'border-ac font-semibold text-tx' : 'border-transparent text-tx2 hover:text-tx')}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== 'progress' && <div className="flex items-center gap-2">{pick(tab)}</div>}
        {tab === 'item' && <ItemView id={ids['item'] ?? null} />}
        {tab === 'quest' && <QuestView id={ids['quest'] ?? null} />}
        {tab === 'npc' && <OwnerView type="npc" id={ids['npc'] ?? null} />}
        {tab === 'enemy' && <OwnerView type="enemy" id={ids['enemy'] ?? null} />}
        {tab === 'progress' && <ProgressView scopeSceneId={scopeSceneId ?? null} onlyPath={!!onlyPath} />}
      </div>
    </Sheet>
  )
}
