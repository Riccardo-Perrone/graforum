import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnSelectionChangeParams
} from '@xyflow/react'
import { ArrowLeft, CircleAlert, CircleCheck, Dices, Lock, MessageSquare, Minus, Play, Plus, Scan, Square, Zap } from 'lucide-react'
import { makeDialogChoice, makeDialogLine, newId, type Dialog, type DialogChoice, type DialogLine } from '@shared/model'
import { stepsSatisfiedBy } from '@shared/engine'
import { EntityChip } from '../components/logic/EntityChip'
import { EffectList, SkillCheckEditor } from '../components/logic/EffectEditor'
import { GateButton, newCheck } from '../components/logic/GateButton'
import { UsageList, useUsage } from '../components/logic/UsageList'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { Field, Select, TextArea, TextInput, Toggle } from '../components/ui/form'
import { DangerButton, IconButton, ToolbarButton, cn } from '../components/ui/primitives'
import { Section } from '../components/ui/Sheet'
import { apply, useProject } from '../lib/entities'
import { useKbd } from '../lib/commands'
import { usePanCursor } from '../lib/cursors'
import { useCommand } from '../lib/shortcuts'
import { useUiStore } from '../store/ui'
import { DialogRunner } from './DialogRunner'

// Editor dei dialoghi a tutto schermo (4): elenco 280px | albero | dettaglio 380px.

const LINE_W = 260
const CHOICE_DX = 330
const CHOICE_DY = 92

type Sel = { kind: 'line'; id: string } | { kind: 'choice'; lineId: string; id: string } | null

interface LineData extends Record<string, unknown> {
  line: DialogLine
  speaker: string
  isStart: boolean
  isEnd: boolean
}
interface ChoiceData extends Record<string, unknown> {
  choice: DialogChoice
  n: number
  checkLabel: string | null
}
interface EndData extends Record<string, unknown> {
  label: string
}
type DNode = Node<LineData, 'line'> | Node<ChoiceData, 'choice'> | Node<EndData, 'end'>

const LineNode = memo(function LineNode({ data, selected }: NodeProps<Node<LineData, 'line'>>) {
  const fx = data.line.effects.length
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-[10px] border bg-raised px-3 py-2.5', selected ? 'border-ac shadow-[0_0_0_4px_var(--acbg)]' : 'border-line2')} style={{ width: LINE_W }}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-tx3">
        {data.isStart && <span className="rounded-[3px] bg-ac px-1.5 py-px font-semibold tracking-[.06em] text-btntx">INIZIO</span>}
        <span>{data.line.id.slice(-4).toUpperCase()}</span>
        <span className="ml-auto flex items-center gap-1 font-sans text-[11px]">
          <MessageSquare size={11} />
          {data.speaker}
        </span>
      </div>
      <div className="line-clamp-4 text-[12.5px] leading-[1.45]">{data.line.text ? `«${data.line.text}»` : <span className="text-tx3">(battuta vuota)</span>}</div>
      {(fx > 0 || data.isEnd) && (
        <div className="flex items-center gap-2 font-mono text-[10px] text-tx3">
          {fx > 0 && (
            <span className="flex items-center gap-1 text-ac">
              <Zap size={10} />
              {fx} effetti
            </span>
          )}
          {data.isEnd && <span className="ml-auto">fine</span>}
        </div>
      )}
    </div>
  )
})

const ChoiceNode = memo(function ChoiceNode({ data, selected }: NodeProps<Node<ChoiceData, 'choice'>>) {
  const c = data.choice
  const gated = c.gate.condition !== null
  return (
    <div
      className={cn('relative flex w-[240px] flex-col gap-1 rounded-2xl border px-3 py-2', gated ? 'border-dashed' : '', selected ? 'border-ac shadow-[0_0_0_4px_var(--acbg)]' : 'border-acln')}
      style={{ background: 'var(--acbg)' }}
    >
      <Handle type="target" position={Position.Left} />
      {c.check ? (
        <>
          <Handle id="success" type="source" position={Position.Right} style={{ top: '35%', background: 'var(--safe)' }} />
          <Handle id="failure" type="source" position={Position.Right} style={{ top: '70%', background: 'var(--err)' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-tx3">
        <span className="font-semibold tracking-[.06em] text-ac">SCELTA · {data.n}</span>
        {gated && <Lock size={10} className="ml-auto text-ac" />}
      </div>
      <div className="text-[12.5px] leading-snug">{c.text || <span className="text-tx3">(scelta vuota)</span>}</div>
      {(data.checkLabel || c.effects.length > 0) && (
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {data.checkLabel && (
            <span className="flex items-center gap-1 text-tx">
              <Dices size={11} />
              {data.checkLabel}
            </span>
          )}
          {c.effects.length > 0 && (
            <span className="flex items-center gap-1 text-ac">
              <Zap size={10} />
              {c.effects.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

const EndNode = memo(function EndNode({ data }: NodeProps<Node<EndData, 'end'>>) {
  return (
    <div className="flex w-[180px] items-center gap-2 rounded-[10px] bg-btn px-3 py-2.5 text-btntx">
      <Handle type="target" position={Position.Left} />
      <Square size={12} fill="currentColor" />
      <div>
        <div className="font-mono text-[10px] font-semibold tracking-[.08em]">FINE DIALOGO</div>
        <div className="text-[11px] opacity-70">{data.label}</div>
      </div>
    </div>
  )
})

const nodeTypes = { line: LineNode, choice: ChoiceNode, end: EndNode }

function speakerName(p: ReturnType<typeof useProject>, d: Dialog, l: DialogLine) {
  if (l.speaker.kind === 'npc') return p.npcs.find((n) => n.id === d.npcId)?.name ?? 'NPC'
  if (l.speaker.kind === 'player') return 'Giocatore'
  return l.speaker.name || 'Altro'
}

function buildDialogGraph(p: ReturnType<typeof useProject>, d: Dialog) {
  const skills = new Map(p.settings.skills.map((s) => [s.id, s.name]))
  const nodes: DNode[] = []
  const edges: Edge[] = []
  const endId = `${d.id}__end`
  let needEnd = false
  const lineExists = new Set(d.lines.map((l) => l.id))
  const marker = (color: string) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color })

  for (const l of d.lines) {
    nodes.push({ id: l.id, type: 'line', position: l.position, data: { line: l, speaker: speakerName(p, d, l), isStart: d.startLineId === l.id, isEnd: l.choices.length === 0 } })
    l.choices.forEach((c, i) => {
      const pos = { x: l.position.x + CHOICE_DX, y: l.position.y + (i - (l.choices.length - 1) / 2) * CHOICE_DY }
      nodes.push({
        id: c.id,
        type: 'choice',
        position: pos,
        draggable: false,
        data: { choice: c, n: i + 1, checkLabel: c.check ? `${(skills.get(c.check.skillId) ?? '?').slice(0, 3).toUpperCase()} ${c.check.dc}` : null }
      })
      edges.push({ id: `${l.id}>${c.id}`, source: l.id, target: c.id, style: { stroke: 'var(--line2)', strokeWidth: 1.5 } })
      const to = (target: string | null) => (target && lineExists.has(target) ? target : ((needEnd = true), endId))
      if (c.check) {
        const s = c.check.success.target?.type === 'dialogLine' ? c.check.success.target.id : c.targetLineId
        const f = c.check.failure.target?.type === 'dialogLine' ? c.check.failure.target.id : null
        edges.push({ id: `${c.id}>ok`, source: c.id, sourceHandle: 'success', target: to(s), label: 'RIUSCITA', style: { stroke: 'var(--safe)', strokeWidth: 1.5 }, markerEnd: marker('var(--safe)'), labelStyle: { fill: 'var(--safe)', fontFamily: 'Geist Mono', fontSize: 10, fontWeight: 600 }, labelBgStyle: { fill: 'var(--bg)' } })
        edges.push({ id: `${c.id}>ko`, source: c.id, sourceHandle: 'failure', target: to(f), label: 'FALLIMENTO', style: { stroke: 'var(--err)', strokeWidth: 1.5, strokeDasharray: '5 4' }, markerEnd: marker('var(--err)'), labelStyle: { fill: 'var(--err)', fontFamily: 'Geist Mono', fontSize: 10, fontWeight: 600 }, labelBgStyle: { fill: 'var(--bg)' } })
      } else {
        edges.push({ id: `${c.id}>t`, source: c.id, target: to(c.targetLineId), style: { stroke: 'var(--line2)', strokeWidth: 1.5 }, markerEnd: marker('var(--line2)') })
      }
    })
  }
  if (needEnd) {
    const maxX = Math.max(0, ...d.lines.map((l) => l.position.x)) + CHOICE_DX * 2
    const avgY = d.lines.length ? d.lines.reduce((n, l) => n + l.position.y, 0) / d.lines.length : 0
    const scene = p.scenes.find((s) => s.npcs.some((n) => n.dialogs.some((x) => x.dialogId === d.id)))
    nodes.push({ id: endId, type: 'end', position: { x: maxX, y: avgY }, draggable: false, data: { label: scene ? `torna a ${scene.title}` : 'chiude il dialogo' } })
  }
  return { nodes, edges }
}

/** Tutti i rami raggiungibili dall'inizio arrivano a una fine? */
function branchCheck(d: Dialog): { ok: boolean; text: string } {
  if (!d.startLineId) return { ok: false, text: 'Manca la battuta iniziale' }
  const ids = new Set(d.lines.map((l) => l.id))
  const seen = new Set<string>()
  const stack = [d.startLineId]
  let broken = 0
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const l = d.lines.find((x) => x.id === id)
    if (!l) {
      broken++
      continue
    }
    for (const c of l.choices) {
      const targets = c.check ? [c.check.success.target?.id ?? c.targetLineId, c.check.failure.target?.id ?? null] : [c.targetLineId]
      for (const t of targets) if (t) (ids.has(t) ? stack.push(t) : broken++)
    }
  }
  const orphans = d.lines.filter((l) => !seen.has(l.id)).length
  if (broken) return { ok: false, text: `${broken} rami puntano a battute inesistenti` }
  if (orphans) return { ok: false, text: `${orphans} battute non raggiungibili dall’inizio` }
  return { ok: true, text: 'Tutti i rami arrivano a una fine' }
}

function updateDialog(id: string, label: string, recipe: (d: Dialog) => void, mergeKey?: string) {
  apply(label, (draft) => {
    const d = draft.dialogs.find((x) => x.id === id)
    if (d) recipe(d)
  }, mergeKey)
}

function Detail({ dialog, sel, setSel }: { dialog: Dialog; sel: Sel; setSel(s: Sel): void }) {
  const p = useProject()
  const line = sel ? dialog.lines.find((l) => l.id === (sel.kind === 'line' ? sel.id : sel.lineId)) : undefined
  const ci = sel?.kind === 'choice' && line ? line.choices.findIndex((c) => c.id === sel.id) : -1
  const choice = ci >= 0 ? line!.choices[ci] : undefined
  const li = line ? dialog.lines.indexOf(line) : -1
  const lineOptions = dialog.lines.map((l) => ({ id: l.id, label: `${l.id.slice(-4).toUpperCase()} · ${l.text.slice(0, 40) || '(vuota)'}` }))

  if (!line)
    return (
      <div className="flex flex-col gap-3 p-5 text-tx3">
        <p className="m-0">Seleziona una battuta o una scelta per modificarla.</p>
        <p className="m-0 text-[12px]">Trascina dalla maniglia destra di una battuta verso un’altra per creare una scelta che porta lì.</p>
      </div>
    )

  if (choice) {
    let n = 0
    return (
      <div className="flex flex-col px-5">
        <Section n={++n} label="Testo">
          <TextArea rows={3} value={choice.text} placeholder="Ciò che dice il giocatore" onCommit={(text) => updateDialog(dialog.id, 'Testo scelta', (d) => void (d.lines[li]!.choices[ci]!.text = text))} />
          {!choice.check && (
            <Field label="Porta a">
              <Select
                value={choice.targetLineId ?? ''}
                options={[['', 'Chiude il dialogo'] as const, ...lineOptions.map((o) => [o.id, o.label] as const)]}
                onChange={(v) => updateDialog(dialog.id, 'Destinazione scelta', (d) => void (d.lines[li]!.choices[ci]!.targetLineId = v || null))}
              />
            </Field>
          )}
        </Section>
        <Section n={++n} label="Visibilità">
          <GateButton gate={choice.gate} title="Visibilità della scelta" onChange={(g) => updateDialog(dialog.id, 'Visibilità scelta', (d) => void (d.lines[li]!.choices[ci]!.gate = g))} />
        </Section>
        <Section n={++n} label="Prova di abilità" right={<Toggle checked={!!choice.check} onChange={(v) => updateDialog(dialog.id, 'Prova scelta', (d) => void (d.lines[li]!.choices[ci]!.check = v ? { ...newCheck(p.settings.skills[0]?.id ?? ''), success: { target: choice.targetLineId ? { type: 'dialogLine', id: choice.targetLineId } : null, effects: [] } } : null))} />}>
          {choice.check ? (
            <SkillCheckEditor check={choice.check} targetType="dialogLine" lineOptions={lineOptions} onChange={(c) => updateDialog(dialog.id, 'Prova scelta', (d) => void (d.lines[li]!.choices[ci]!.check = c))} />
          ) : (
            <span className="text-[12px] text-tx3">Nessuna prova: la scelta porta sempre alla stessa battuta.</span>
          )}
        </Section>
        <Section n={++n} label="Effetti della scelta">
          <EffectList effects={choice.effects} onChange={(fx) => updateDialog(dialog.id, 'Effetti scelta', (d) => void (d.lines[li]!.choices[ci]!.effects = fx))} />
        </Section>
        <div className="flex justify-center py-5">
          <DangerButton
            onClick={async () => {
              if (!(await confirmDialog({ title: `Eliminare la scelta «${choice.text || '(vuota)'}»?`, confirmLabel: 'Elimina scelta' }))) return
              updateDialog(dialog.id, 'Elimina scelta', (d) => void d.lines[li]!.choices.splice(ci, 1))
              setSel({ kind: 'line', id: line.id })
            }}
          >
            Elimina scelta
          </DangerButton>
        </div>
      </div>
    )
  }

  let n = 0
  const speakerKind = line.speaker.kind
  return (
    <div className="flex flex-col px-5">
      <Section n={++n} label="Chi parla">
        <div className="flex gap-2">
          <Select
            className="w-[150px]"
            value={speakerKind}
            options={[
              ['npc', p.npcs.find((x) => x.id === dialog.npcId)?.name ?? 'NPC'],
              ['player', 'Giocatore'],
              ['other', 'Altro…']
            ]}
            onChange={(k) => updateDialog(dialog.id, 'Chi parla', (d) => void (d.lines[li]!.speaker = k === 'other' ? { kind: 'other', name: '' } : { kind: k }))}
          />
          {line.speaker.kind === 'other' && (
            <TextInput className="flex-1" placeholder="Nome" value={line.speaker.name} onCommit={(name) => updateDialog(dialog.id, 'Chi parla', (d) => void (d.lines[li]!.speaker = { kind: 'other', name }))} />
          )}
        </div>
        <Toggle checked={dialog.startLineId === line.id} label="Battuta iniziale" onChange={(v) => v && updateDialog(dialog.id, 'Battuta iniziale', (d) => void (d.startLineId = line.id))} />
      </Section>
      <Section n={++n} label="Testo">
        <TextArea rows={5} value={line.text} onCommit={(text) => updateDialog(dialog.id, 'Testo battuta', (d) => void (d.lines[li]!.text = text))} />
      </Section>
      <Section n={++n} label="Effetti">
        <EffectList effects={line.effects} onChange={(fx) => updateDialog(dialog.id, 'Effetti battuta', (d) => void (d.lines[li]!.effects = fx))} emptyText="Nessun effetto: battuta solo di contesto." />
      </Section>
      <Section n={++n} label={`Scelte · ${line.choices.length}`}>
        {line.choices.length === 0 && <span className="text-[12px] text-tx3">Zero scelte: qui il dialogo finisce.</span>}
        {line.choices.map((c, i) => (
          <button key={c.id} type="button" onClick={() => setSel({ kind: 'choice', lineId: line.id, id: c.id })} className="flex items-center gap-2 rounded-2xl border border-acln bg-acbg px-3 py-1.5 text-left text-[12px] hover:brightness-125">
            <span className="font-mono text-[10px] text-ac">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{c.text || '(vuota)'}</span>
            {c.gate.condition && <Lock size={11} className="text-ac" />}
            {c.check && <Dices size={11} />}
          </button>
        ))}
        <div>
          <button
            type="button"
            className="text-[11.5px] text-tx2 hover:text-tx"
            onClick={() => {
              const choice = makeDialogChoice()
              updateDialog(dialog.id, 'Nuova scelta', (d) => void d.lines[li]!.choices.push(choice))
              setSel({ kind: 'choice', lineId: line.id, id: choice.id })
            }}
          >
            + Scelta
          </button>
        </div>
      </Section>
      <div className="flex justify-center py-5">
        <DangerButton
          onClick={async () => {
            const incoming = dialog.lines.reduce(
              (n, l) => n + l.choices.filter((c) => c.targetLineId === line.id || c.check?.success.target?.id === line.id || c.check?.failure.target?.id === line.id).length,
              0
            )
            const text = line.text ? `«${line.text.slice(0, 50)}${line.text.length > 50 ? '…' : ''}»` : 'vuota'
            const detail = [
              line.choices.length ? `${line.choices.length} scelte collegate a questa battuta verranno eliminate.` : '',
              incoming ? `${incoming} scelte che portano qui resteranno senza destinazione.` : '',
              dialog.startLineId === line.id ? 'Era la battuta iniziale.' : ''
            ]
              .filter(Boolean)
              .join('\n')
            if (!(await confirmDialog({ title: `Eliminare la battuta ${text}?`, detail: detail || undefined, confirmLabel: 'Elimina battuta' }))) return
            updateDialog(dialog.id, 'Elimina battuta', (d) => {
              d.lines = d.lines.filter((l) => l.id !== line.id)
              if (d.startLineId === line.id) d.startLineId = d.lines[0]?.id ?? null
              for (const l of d.lines)
                for (const c of l.choices) {
                  if (c.targetLineId === line.id) c.targetLineId = null
                  if (c.check?.success.target?.id === line.id) c.check.success.target = null
                  if (c.check?.failure.target?.id === line.id) c.check.failure.target = null
                }
            })
            setSel(null)
          }}
        >
          Elimina battuta
        </DangerButton>
      </div>
    </div>
  )
}

function DialogCanvas({ dialog, sel, setSel }: { dialog: Dialog; sel: Sel; setSel(s: Sel): void }) {
  const p = useProject()
  const flow = useReactFlow()
  usePanCursor()
  const [zoom, setZoom] = useState(1)
  const graph = useMemo(() => buildDialogGraph(p, dialog), [p, dialog])
  const [nodes, setNodes] = useState<DNode[]>(graph.nodes)
  // Selezione multipla (riquadro con il tasto sinistro): se è una sola il dettaglio la mostra, altrimenti restano evidenziate.
  const multi = useRef<Set<string>>(new Set())
  useEffect(() => {
    setNodes(graph.nodes.map((n) => ({ ...n, selected: sel ? n.id === sel.id : multi.current.has(n.id) })))
  }, [graph.nodes, sel])
  const onSelectionChange = useCallback(
    ({ nodes: picked }: OnSelectionChangeParams) => {
      multi.current = new Set(picked.map((n) => n.id))
      if (picked.length > 1 && sel) setSel(null)
      const one = picked.length === 1 ? picked[0]! : null
      if (one && one.id !== sel?.id) {
        if (one.type === 'line') setSel({ kind: 'line', id: one.id })
        if (one.type === 'choice') setSel({ kind: 'choice', lineId: dialog.lines.find((l) => l.choices.some((c) => c.id === one.id))!.id, id: one.id })
      }
    },
    [sel, setSel, dialog]
  )
  useEffect(() => {
    void flow.fitView({ padding: 0.2 })
  }, [dialog.id, flow])

  const onConnect = useCallback(
    (c: Connection) => {
      const target = c.target
      if (!c.source || !target || !dialog.lines.some((l) => l.id === target)) return
      const fromLine = dialog.lines.find((l) => l.id === c.source)
      updateDialog(dialog.id, 'Collega', (d) => {
        if (fromLine) {
          // Da battuta a battuta: nuova scelta che porta lì.
          d.lines.find((l) => l.id === fromLine.id)!.choices.push(makeDialogChoice(target))
          return
        }
        for (const l of d.lines) {
          const ch = l.choices.find((x) => x.id === c.source)
          if (!ch) continue
          if (ch.check && c.sourceHandle === 'failure') ch.check.failure.target = { type: 'dialogLine', id: target }
          else if (ch.check) ch.check.success.target = { type: 'dialogLine', id: target }
          else ch.targetLineId = target
        }
      })
    },
    [dialog]
  )

  return (
    <ReactFlow<DNode>
      nodes={nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      onNodesChange={(ch: NodeChange<DNode>[]) => setNodes((ns) => applyNodeChanges(ch, ns))}
      selectionOnDrag
      panOnDrag={[1]}
      selectionMode={SelectionMode.Partial}
      onSelectionChange={onSelectionChange}
      onNodeDragStop={(_, __, dragged) =>
        updateDialog(dialog.id, dragged.length > 1 ? 'Sposta battute' : 'Sposta battuta', (d) => {
          for (const n of dragged) {
            const l = d.lines.find((x) => x.id === n.id)
            if (l) l.position = { x: Math.round(n.position.x), y: Math.round(n.position.y) }
          }
        })
      }
      onNodeClick={(e, n) => {
        if (e.ctrlKey || e.shiftKey || e.metaKey) return
        if (n.type === 'line') setSel({ kind: 'line', id: n.id })
        if (n.type === 'choice') setSel({ kind: 'choice', lineId: dialog.lines.find((l) => l.choices.some((c) => c.id === n.id))!.id, id: n.id })
      }}
      onPaneClick={() => setSel(null)}
      onConnect={onConnect}
      onMove={(_, v) => setZoom(v.zoom)}
      deleteKeyCode={null}
      minZoom={0.2}
      maxZoom={2}
      fitView
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--bg)' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--dot)" />
      <Panel position="bottom-left" className="!m-4">
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-[3px] text-tx2">
          <IconButton icon={Minus} onClick={() => flow.zoomOut()} />
          <span className="w-[42px] text-center font-mono text-[11px] text-tx">{Math.round(zoom * 100)}%</span>
          <IconButton icon={Plus} onClick={() => flow.zoomIn()} />
          <IconButton icon={Scan} onClick={() => flow.fitView({ padding: 0.2, duration: 200 })} />
        </div>
      </Panel>
    </ReactFlow>
  )
}

export function DialogEditor({ dialogId }: { dialogId: string }) {
  const p = useProject()
  const ui = useUiStore()
  const dialog = p.dialogs.find((d) => d.id === dialogId)
  const [sel, setSel] = useState<Sel>(null)
  const [running, setRunning] = useState(false)
  const usage = useUsage(dialogId)
  // Le funzioni addLine/addChoice sono definite più sotto: i comandi le chiamano solo alla pressione del tasto.
  useCommand('newLine', () => dialog && !running && addLine())
  useCommand('newChoice', () => dialog && !running && addChoice())
  const kbdLine = useKbd('newLine')
  const kbdChoice = useKbd('newChoice')
  if (!dialog) return <div className="p-8 text-tx3">Dialogo non trovato.</div>
  const npc = p.npcs.find((n) => n.id === dialog.npcId)
  const siblings = p.dialogs.filter((d) => d.npcId === dialog.npcId)
  const check = branchCheck(dialog)
  const contextOnly = (d: Dialog) => d.lines.every((l) => l.effects.length === 0 && l.choices.every((c) => c.effects.length === 0 && !c.check))
  const steps = stepsSatisfiedBy(p, 'dialog', dialog.id)
  const selectedLine = sel ? (sel.kind === 'line' ? sel.id : sel.lineId) : null

  const addLine = () => {
    const base = dialog.lines.find((l) => l.id === selectedLine)?.position ?? { x: 0, y: 0 }
    const line = makeDialogLine({ x: base.x + CHOICE_DX * 2, y: base.y + 40 })
    updateDialog(dialog.id, 'Nuova battuta', (d) => {
      d.lines.push(line)
      if (!d.startLineId) d.startLineId = line.id
    })
    setSel({ kind: 'line', id: line.id })
  }
  const addChoice = () => {
    const line = dialog.lines.find((l) => l.id === selectedLine)
    if (!line) return
    const choice = makeDialogChoice()
    updateDialog(dialog.id, 'Nuova scelta', (d) => void d.lines.find((l) => l.id === line.id)!.choices.push(choice))
    setSel({ kind: 'choice', lineId: line.id, id: choice.id })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-panel px-3 py-1">
        <ToolbarButton icon={ArrowLeft} variant="outline" onClick={() => ui.setView({ kind: 'dialogList' })}>
          Elenco dialoghi
        </ToolbarButton>
        <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">DIALOGO</span>
        {npc && <EntityChip type="npc" id={npc.id} />}
        <span className="text-tx3">›</span>
        <TextInput className="h-7 w-[260px] font-semibold" value={dialog.title} onCommit={(title) => updateDialog(dialog.id, 'Titolo dialogo', (d) => void (d.title = title))} />
        <span className="mx-1 h-5 w-px bg-line2" />
        <ToolbarButton icon={MessageSquare} kbd={kbdLine} onClick={addLine}>
          Battuta
        </ToolbarButton>
        <ToolbarButton icon={Plus} kbd={kbdChoice} disabled={!selectedLine} onClick={addChoice}>
          Scelta
        </ToolbarButton>
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-tx3">
          {dialog.lines.length} battute · {dialog.lines.reduce((n, l) => n + l.choices.length, 0)} scelte · {dialog.lines.reduce((n, l) => n + l.choices.filter((c) => c.check).length, 0)} prove
        </span>
        <ToolbarButton icon={Play} variant="primary" onClick={() => setRunning(true)} disabled={!dialog.startLineId}>
          Prova dialogo
        </ToolbarButton>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] flex-none flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-3" data-text-scale>
          <div className="flex flex-col gap-1">
            <span className="px-1 pb-1 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">DIALOGHI DI {npc?.name.toUpperCase()}</span>
            {siblings.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => (setSel(null), ui.setView({ kind: 'dialog', dialogId: d.id }))}
                className={cn('flex flex-col rounded-md border px-2.5 py-1.5 text-left', d.id === dialog.id ? 'border-acln bg-acbg' : contextOnly(d) ? 'border-dashed border-line2 hover:bg-hover' : 'border-transparent hover:bg-hover')}
              >
                <span className="font-medium">{d.title}</span>
                <span className="font-mono text-[10.5px] text-tx3">
                  {d.lines.length} nodi · {contextOnly(d) ? 'solo contesto · nessun effetto' : `${d.lines.reduce((n, l) => n + l.effects.length + l.choices.reduce((m, c) => m + c.effects.length, 0), 0)} effetti`}
                </span>
              </button>
            ))}
            <button
              type="button"
              className="px-1 pt-1 text-left text-[11.5px] text-tx2 hover:text-tx"
              onClick={() => {
                const id = newId('dialog')
                apply('Nuovo dialogo', (d) => void d.dialogs.push({ id, npcId: dialog.npcId, title: 'Nuovo dialogo', startLineId: null, lines: [] }))
                ui.setView({ kind: 'dialog', dialogId: id })
              }}
            >
              + Nuovo dialogo
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="px-1 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">USATO IN</span>
            <UsageList owners={usage} />
          </div>
          {steps.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="px-1 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">COMPLETA STEP DI QUEST</span>
              {steps.map((s) => (
                <EntityChip key={s.stepId} type="quest" id={s.questId} label={s.label} />
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-line p-2.5 text-[11.5px] text-tx2">
            <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">LEGENDA</span>
            <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-[3px] border border-line2 bg-raised" />Battuta NPC</span>
            <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-full border border-acln bg-acbg" />Scelta del giocatore</span>
            <span className="flex items-center gap-2"><Dices size={12} />Prova di abilità</span>
            <span className="flex items-center gap-2"><Lock size={12} className="text-ac" />Condizione di visibilità</span>
            <span className="flex items-center gap-2"><Zap size={12} className="text-ac" />Effetto</span>
            <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-[3px] bg-btn" />Fine dialogo</span>
            <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-[3px] border border-dashed border-line2" />Dialogo solo contesto</span>
          </div>
        </aside>
        <div className="relative min-w-0 flex-1">
          <ReactFlowProvider>
            <DialogCanvas dialog={dialog} sel={sel} setSel={setSel} />
          </ReactFlowProvider>
          {dialog.lines.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-tx3">
              <span className="pointer-events-auto flex flex-col items-center gap-2">
                Dialogo vuoto.
                <ToolbarButton icon={MessageSquare} variant="default" onClick={addLine}>
                  Prima battuta
                </ToolbarButton>
              </span>
            </div>
          )}
        </div>
        <aside className="flex w-[380px] flex-none flex-col overflow-y-auto border-l border-line bg-panel" data-text-scale>
          <div className="border-b border-line px-5 py-3">
            <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">
              {sel?.kind === 'choice' ? 'SCELTA' : sel?.kind === 'line' ? 'BATTUTA' : 'DETTAGLIO'}
              {sel && ` · ${sel.id.slice(-4).toUpperCase()}`}
            </span>
            {sel?.kind === 'choice' && <div className="text-[12px] text-tx3">Parla: Giocatore · risponde a {sel.lineId.slice(-4).toUpperCase()}</div>}
          </div>
          <Detail dialog={dialog} sel={sel} setSel={setSel} />
        </aside>
      </div>
      <footer className="flex h-[26px] flex-none items-center gap-4 border-t border-line bg-panel px-3 font-mono text-[11px] text-tx3">
        <span>Dialogo · {dialog.lines.length} nodi</span>
        <span className={cn('flex items-center gap-1', check.ok ? 'text-safe' : 'text-warn')}>
          {check.ok ? <CircleCheck size={11} /> : <CircleAlert size={11} />}
          {check.text}
        </span>
        <span className="flex-1" />
      </footer>
      {running && <DialogRunner dialog={dialog} onClose={() => setRunning(false)} />}
    </div>
  )
}
