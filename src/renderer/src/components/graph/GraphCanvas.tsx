import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams
} from '@xyflow/react'
import { Magnet, Minus, Plus, Scan, Search, X } from 'lucide-react'
import { newId } from '@shared/model'
import { decisivePath, validate } from '@shared/engine'
import { useKbd } from '../../lib/commands'
import { usePanCursor } from '../../lib/cursors'
import { useCommand } from '../../lib/shortcuts'
import { emptyGate } from '../../lib/entities'
import { assignToGroup, canLink, deleteLinks, deleteScenes } from '../../lib/sceneOps'
import { useProjectStore } from '../../store/project'
import { openEntity, useUiStore } from '../../store/ui'
import { isConfirmOpen } from '../ui/ConfirmDialog'
import { Kbd } from '../ui/primitives'
import { SCENE_NODE_HEIGHT, buildGraph, groupDescendants, type FlowNode } from './buildGraph'
import { ContextMenu, type MenuState } from './ContextMenu'
import { CollapsedGroupNode, GroupNode } from './GroupNode'
import { LinkEdge, type LinkFlowEdge } from './LinkEdge'
import { SCENE_NODE_WIDTH, SceneNode, type SceneFlowNode } from './SceneNode'
import { SNAP_DISTANCE, computeSnap, type Box, type Guide } from './snap'

const nodeTypes = { scene: SceneNode, sceneGroup: GroupNode, collapsedGroup: CollapsedGroupNode }
const edgeTypes = { link: LinkEdge }

const TAG_COLOR = { neutral: 'var(--tx3)', safe: 'var(--safe)', warning: 'var(--warn)' } as const
export const CATALOG_DRAG_TYPE = 'application/x-graforum-entity'
/** Tempo di permanenza sull'area di un gruppo prima che il rilascio aggiunga le scene al gruppo. */
const DROP_DWELL_MS = 900

const nodeBox = (n: FlowNode): Box => ({
  x: n.position.x,
  y: n.position.y,
  w: n.measured?.width ?? (n.type === 'sceneGroup' ? n.data.width : SCENE_NODE_WIDTH),
  h: n.measured?.height ?? (n.type === 'sceneGroup' ? n.data.height : SCENE_NODE_HEIGHT)
})

export function GraphCanvas() {
  const project = useProjectStore((s) => s.project)!
  const apply = useProjectStore((s) => s.apply)
  const { setSelection, setZoom, zoom, highlight, pathEndingId, focus, setHighlight } = useUiStore()
  const flow = useReactFlow()
  usePanCursor()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [selEdges, setSelEdges] = useState<string[]>([])

  const graph = useMemo(() => buildGraph(project), [project])
  const issues = useMemo(() => validate(project), [project])
  const path = useMemo(() => (pathEndingId ? decisivePath(project, pathEndingId) : null), [project, pathEndingId])
  const pathColor = project.endings.find((e) => e.id === pathEndingId)?.color ?? null

  // Sovrapposizioni: validazione, attenuazione da ricerca/filtri, percorso del finale.
  const decorated = useMemo(() => {
    const byScene = new Map<string, { errors: number; warnings: number; text: string }>()
    for (const i of issues) {
      if (!i.sceneId || i.severity === 'note') continue
      const cur = byScene.get(i.sceneId) ?? { errors: 0, warnings: 0, text: '' }
      if (i.severity === 'error') cur.errors++
      else cur.warnings++
      if (!cur.text || i.severity === 'error') cur.text = i.title
      byScene.set(i.sceneId, cur)
    }
    const nodes = graph.nodes
      .map((n): FlowNode => {
        if (n.type !== 'scene') return { ...n, data: { ...n.data, dim: !!highlight } } as FlowNode
        const v = byScene.get(n.id)
        const hit = highlight?.sceneIds.has(n.id) ?? false
        return {
          ...n,
          hidden: !!highlight?.hideOthers && !hit,
          data: {
            ...n.data,
            errors: v?.errors ?? 0,
            warnings: v?.warnings ?? 0,
            issueText: v?.text,
            dim: !!highlight && !hit,
            hit: !!highlight && hit && !highlight.hideOthers,
            pathColor: !highlight && path?.sceneIds.has(n.id) ? pathColor : null
          }
        }
      })
    const edges = graph.edges.map(
      (e): LinkFlowEdge => ({
        ...e,
        selected: selEdges.includes(e.id),
        data: {
          ...e.data!,
          dim: !!highlight && !(highlight.sceneIds.has(e.source) && highlight.sceneIds.has(e.target)),
          pathColor: !highlight && path && (path.linkIds.has(e.id) || path.manualIds.has(e.id)) ? pathColor : null
        }
      })
    )
    return { nodes, edges }
  }, [graph, issues, highlight, path, pathColor, selEdges])

  // Centra una scena richiesta da ricerca, validazione, "Usato in"…
  useEffect(() => {
    if (!focus) return
    const n = flow.getNode(focus.sceneId)
    if (!n) return
    const w = n.measured?.width ?? 200
    const h = n.measured?.height ?? 136
    void flow.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: Math.max(flow.getZoom(), 0.85), duration: 300 })
  }, [focus, flow])

  // I nodi vivono in uno stato locale durante il trascinamento; la posizione va nel progetto al rilascio.
  // Se il grafo si apre con scene già selezionate (es. da "Usato in"), i nodi partono selezionati:
  // altrimenti React Flow segnala una selezione vuota e lo store gli rimanda quella vecchia, all'infinito.
  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    const selected = new Set(useUiStore.getState().selectedSceneIds)
    return decorated.nodes.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n))
  })
  const nodesRef = useRef(nodes)
  const commit = useCallback((next: FlowNode[]) => {
    nodesRef.current = next
    setNodes(next)
  }, [])
  const selectedIds = useUiStore((s) => s.selectedSceneIds)
  useEffect(() => {
    const selected = new Set(useUiStore.getState().selectedSceneIds)
    commit(decorated.nodes.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n)))
  }, [decorated.nodes, commit])
  useEffect(() => {
    const selected = new Set(selectedIds)
    commit(nodesRef.current.map((n) => (n.type === 'scene' && !!n.selected !== selected.has(n.id) ? { ...n, selected: selected.has(n.id) } : n)))
  }, [selectedIds, commit])

  // Aggancio ai bordi e ai centri degli altri nodi (Alt lo sospende).
  const snapOn = useUiStore((s) => s.snap)
  const kbdSnap = useKbd('toggleSnap')
  const [guides, setGuides] = useState<Guide[]>([])
  const altDown = useRef(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => void (altDown.current = e.altKey)
    const onBlur = () => void (altDown.current = false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  /** Nodi che si muovono insieme a un gruppo trascinato: scene, gruppi collassati e sottogruppi. */
  const groupMembers = useCallback(
    (groupId: string, ns: FlowNode[]) => {
      const ids = groupDescendants(project, groupId)
      return ns.filter((n) => {
        if (n.type === 'scene') return !!n.data.scene.groupId && ids.has(n.data.scene.groupId)
        return n.id !== groupId && ids.has(n.data.group.id)
      })
    },
    [project]
  )

  /** Il gruppo di destinazione è quello della scena o un suo antenato? Salire di livello si fa solo con "Rimuovi dal gruppo". */
  const isSameOrAncestor = useCallback(
    (targetId: string, sceneGroupId: string | null) => {
      let g = sceneGroupId ? project.groups.find((x) => x.id === sceneGroupId) : undefined
      while (g) {
        if (g.id === targetId) return true
        g = g.parentId ? project.groups.find((x) => x.id === g!.parentId) : undefined
      }
      return false
    },
    [project.groups]
  )

  // Gruppo su cui si sta trattenendo il trascinamento: dopo una breve pausa il rilascio aggiunge le scene.
  const [armed, setArmed] = useState<string | null>(null)
  const armedRef = useRef<string | null>(null)
  const dwell = useRef<{ groupId: string | null; timer: number | undefined }>({ groupId: null, timer: undefined })
  const clearDwell = useCallback(() => {
    window.clearTimeout(dwell.current.timer)
    dwell.current = { groupId: null, timer: undefined }
    armedRef.current = null
    setArmed(null)
  }, [])
  useEffect(() => () => window.clearTimeout(dwell.current.timer), [])
  useEffect(() => {
    commit(nodesRef.current.map((n) => (n.type === 'sceneGroup' && !!n.data.drop !== (n.id === armed) ? { ...n, data: { ...n.data, drop: n.id === armed } } : n)))
  }, [armed, commit])

  type PositionChange = Extract<NodeChange<FlowNode>, { type: 'position' }>
  /** Ultimo scostamento di aggancio: anche la posizione finale (a puntatore rilasciato) lo include. */
  const lastSnap = useRef({ dx: 0, dy: 0 })
  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      let list = changes
      const ns = nodesRef.current
      const moves = changes.filter((c): c is PositionChange => c.type === 'position' && !!c.dragging && !!c.position)
      if (moves.length) {
        const moved = new Set(moves.map((m) => m.id))
        const dragged = ns.filter((n) => moved.has(n.id))
        const excluded = new Set<string>(moved)
        for (const g of dragged) if (g.type === 'sceneGroup') for (const m of groupMembers(g.id, ns)) excluded.add(m.id)
        let dx = 0
        let dy = 0
        let found: Guide[] = []
        if (snapOn && !altDown.current) {
          const boxes = moves.map((m) => ({ ...nodeBox(ns.find((n) => n.id === m.id)!), x: m.position!.x, y: m.position!.y }))
          const x1 = Math.min(...boxes.map((b) => b.x))
          const y1 = Math.min(...boxes.map((b) => b.y))
          const x2 = Math.max(...boxes.map((b) => b.x + b.w))
          const y2 = Math.max(...boxes.map((b) => b.y + b.h))
          const others = ns.filter((n) => (n.type === 'scene' || n.type === 'collapsedGroup') && !n.hidden && !excluded.has(n.id)).map(nodeBox)
          const snapped = computeSnap({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, others, SNAP_DISTANCE / flow.getZoom())
          dx = snapped.dx
          dy = snapped.dy
          found = snapped.guides
        }
        lastSnap.current = { dx, dy }
        setGuides((cur) => (cur.length === 0 && found.length === 0 ? cur : found))
        list = changes.map((c) => (c.type === 'position' && moves.includes(c) ? { ...c, position: { x: c.position!.x + dx, y: c.position!.y + dy } } : c))
        // Un gruppo trascinato porta con sé tutto ciò che contiene.
        for (const g of dragged) {
          if (g.type !== 'sceneGroup') continue
          const to = (list.find((c): c is PositionChange => c.type === 'position' && c.id === g.id))!.position!
          const mx = to.x - g.position.x
          const my = to.y - g.position.y
          for (const m of groupMembers(g.id, ns)) {
            if (moved.has(m.id)) continue
            list = [...list, { type: 'position', id: m.id, dragging: true, position: { x: m.position.x + mx, y: m.position.y + my } }]
          }
        }
      }
      const ends = changes.filter((c): c is PositionChange => c.type === 'position' && c.dragging === false && !!c.position)
      if (ends.length) {
        const { dx, dy } = lastSnap.current
        list = changes.map((c) => (c.type === 'position' && ends.includes(c) ? { ...c, position: { x: c.position!.x + dx, y: c.position!.y + dy } } : c))
        lastSnap.current = { dx: 0, dy: 0 }
      }
      commit(applyNodeChanges(list, ns))
    },
    [commit, flow, groupMembers, snapOn]
  )

  /** Mentre si trascina: se il puntatore resta sull'area di un gruppo, dopo una pausa il gruppo si "arma". */
  const onNodeDrag = useCallback(
    (e: React.MouseEvent | MouseEvent | TouchEvent, _: FlowNode, dragged: FlowNode[]) => {
      const scenes = dragged.filter((n): n is SceneFlowNode => n.type === 'scene')
      const pt = 'clientX' in e ? flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }) : null
      let target: string | null = null
      if (pt && scenes.length) {
        let best = Infinity
        for (const n of graph.nodes) {
          if (n.type !== 'sceneGroup') continue
          const inside = pt.x >= n.position.x && pt.x <= n.position.x + n.data.width && pt.y >= n.position.y && pt.y <= n.position.y + n.data.height
          const area = n.data.width * n.data.height
          if (inside && area < best && scenes.some((sc) => !isSameOrAncestor(n.id, sc.data.scene.groupId))) {
            target = n.id
            best = area
          }
        }
      }
      if (target === dwell.current.groupId) return
      clearDwell()
      if (!target) return
      const groupId = target
      dwell.current = {
        groupId,
        timer: window.setTimeout(() => {
          armedRef.current = groupId
          setArmed(groupId)
        }, DROP_DWELL_MS)
      }
    },
    [flow, graph.nodes, clearDwell, isSameOrAncestor]
  )

  const onNodeDragStop = useCallback(
    (_: unknown, __: FlowNode, draggedByFlow: FlowNode[]) => {
      setGuides([])
      document.body.classList.remove('is-dragging-group')
      // Le posizioni valide sono quelle già agganciate del nostro stato, non quelle grezze del puntatore.
      const dragged = draggedByFlow.map((n) => nodesRef.current.find((x) => x.id === n.id) ?? n)
      const target = armedRef.current
      clearDwell()
      const moved = dragged.filter((n) => n.type === 'scene' || n.type === 'collapsedGroup')
      const groups = dragged.filter((n) => n.type === 'sceneGroup')
      const explicit = new Set(dragged.map((n) => n.id))
      const label = groups.length ? 'Sposta gruppo' : moved.length > 1 ? 'Sposta scene' : 'Sposta scena'
      apply(label, (draft) => {
        for (const n of moved) {
          const scene = draft.scenes.find((s) => s.id === n.id)
          if (scene) scene.position = { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        }
        // Spostare la carta o l'area di un gruppo sposta tutte le scene del gruppo.
        for (const n of [...moved.filter((x) => x.type === 'collapsedGroup'), ...groups]) {
          const before = graph.nodes.find((x) => x.id === n.id)
          if (!before) continue
          const dx = Math.round(n.position.x - before.position.x)
          const dy = Math.round(n.position.y - before.position.y)
          const ids = new Set([n.id])
          for (const g of draft.groups) if (g.parentId && ids.has(g.parentId)) ids.add(g.id)
          for (const s of draft.scenes) if (s.groupId && ids.has(s.groupId) && !explicit.has(s.id)) s.position = { x: s.position.x + dx, y: s.position.y + dy }
        }
        if (target) assignToGroup(
            draft,
            moved.filter((n): n is SceneFlowNode => n.type === 'scene' && !isSameOrAncestor(target, n.data.scene.groupId)).map((n) => n.id),
            target
          )
      })
    },
    [apply, graph.nodes, clearDwell, isSameOrAncestor]
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      apply('Nuovo collegamento', (draft) => {
        if (!canLink(draft, c.source, c.target)) return
        if (!draft.scenes.some((s) => s.id === c.source) || !draft.scenes.some((s) => s.id === c.target)) return
        draft.links.push({ id: newId('link'), fromSceneId: c.source, toSceneId: c.target, label: '', bidirectional: false, gate: emptyGate(), effects: [], checks: [] })
      })
    },
    [apply]
  )

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const sel = changes.filter((c): c is Extract<EdgeChange, { type: 'select' }> => c.type === 'select')
    if (!sel.length) return
    setSelEdges((cur) => {
      const next = new Set(cur)
      for (const c of sel) c.selected ? next.add(c.id) : next.delete(c.id)
      return next.size === cur.length && cur.every((id) => next.has(id)) ? cur : [...next]
    })
  }, [])

  // Canc: elimina le scene selezionate (coi loro collegamenti) oppure i collegamenti selezionati; chiede conferma.
  useCommand('deleteSelection', () => {
    const ui = useUiStore.getState()
    if (ui.sheet || isConfirmOpen()) return
    const links = selEdges.filter((id) => project.links.some((l) => l.id === id))
    if (ui.selectedSceneIds.length) {
      void deleteScenes(ui.selectedSceneIds).then((blocked) => blocked && ui.showBlocked(blocked))
    } else if (links.length) {
      setSelEdges([])
      void deleteLinks(links)
    }
  })

  // La selezione nello store segue i nodi locali (aggiornati dai clic via onNodesChange), non quanto riportato da
  // React Flow: i suoi rapporti possono essere in ritardo e, rimandati allo store, si rimbalzano all'infinito.
  const onSelectionChange = useCallback(
    (_: OnSelectionChangeParams) => {
      const ids = nodesRef.current.filter((n) => n.type === 'scene' && n.selected).map((n) => n.id)
      const cur = useUiStore.getState().selectedSceneIds
      if (ids.length !== cur.length || ids.some((id, i) => id !== cur[i])) setSelection(ids)
      // Un gruppo collassato selezionato da solo compare nel pannello a sinistra.
      const groups = nodesRef.current.filter((n) => n.type === 'collapsedGroup' && n.selected)
      if (!ids.length && groups.length === 1 && useUiStore.getState().selectedGroupId !== groups[0]!.id) useUiStore.getState().setSelectedGroup(groups[0]!.id)
    },
    [setSelection]
  )

  // Trascina una voce di catalogo su una scena per aggiungerla.
  const onDrop = useCallback(
    (e: DragEvent) => {
      const raw = e.dataTransfer.getData(CATALOG_DRAG_TYPE)
      if (!raw) return
      e.preventDefault()
      const { type, id } = JSON.parse(raw) as { type: string; id: string }
      const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const target = flow.getIntersectingNodes({ x: pos.x, y: pos.y, width: 1, height: 1 }).find((n) => n.type === 'scene')
      if (!target) return
      apply('Aggiungi alla scena', (d) => {
        const s = d.scenes.find((x) => x.id === target.id)
        if (!s) return
        if (type === 'npc' && !s.npcs.some((n) => n.npcId === id)) s.npcs.push({ npcId: id, gate: emptyGate(), dialogs: [] })
        if (type === 'item') s.items.push({ id: newId('sceneItem'), itemId: id, quantity: 1, gate: emptyGate(), checks: [] })
        if (type === 'enemy') {
          const encId = newId('encounter')
          d.encounters.push({
            id: encId,
            name: `Incontro in ${s.title}`,
            enemies: [{ enemyId: id, quantity: 1 }],
            nature: 'unique',
            rewards: { xp: 0, items: [] },
            outcomes: { win: { target: null, effects: [] }, flee: { target: null, effects: [] }, defeat: { target: null, effects: [] } }
          })
          s.encounterIds.push(encId)
          s.tag = 'warning'
        }
      })
      useUiStore.getState().focusScene(target.id)
    },
    [apply, flow]
  )

  return (
    <>
      <ReactFlow<FlowNode, LinkFlowEdge>
        nodes={nodes}
        edges={decorated.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={(_, n) => n.type === 'sceneGroup' && document.body.classList.add('is-dragging-group')}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        selectionOnDrag
        panOnDrag={[1]}
        selectionMode={SelectionMode.Partial}
        onSelectionContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, kind: 'selection', id: '' })
        }}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={(_, n) => n.type === 'scene' && openEntity('scene', n.id)}
        onNodeContextMenu={(e, n) => {
          e.preventDefault()
          if (n.type === 'scene' && !useUiStore.getState().selectedSceneIds.includes(n.id)) setSelection([n.id])
          if (n.type === 'scene') setMenu({ x: e.clientX, y: e.clientY, kind: 'scene', id: n.id })
          else setMenu({ x: e.clientX, y: e.clientY, kind: 'group', id: n.id })
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault()
          const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })
          setMenu({ x: e.clientX, y: e.clientY, kind: 'pane', id: '', flowPos: pos })
        }}
        onEdgeDoubleClick={(_, edge) => openEntity('link', edge.id)}
        onPaneClick={() => (setMenu(null), useUiStore.getState().setSelectedGroup(null))}
        onMove={(_, viewport) => setZoom(viewport.zoom)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(CATALOG_DRAG_TYPE)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={onDrop}
        deleteKeyCode={null}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--dot)" />
        {guides.length > 0 && (
          <ViewportPortal>
            {guides.map((g, i) => (
              <div
                key={i}
                className="pointer-events-none absolute"
                style={{
                  background: '#ff4d8d',
                  ...(g.axis === 'x' ? { left: g.pos, top: g.from, width: 1 / zoom, height: g.to - g.from } : { left: g.from, top: g.pos, width: g.to - g.from, height: 1 / zoom })
                }}
              />
            ))}
          </ViewportPortal>
        )}
        {highlight && (
          <Panel position="top-center" className="!mt-3.5">
            <div className="flex items-center gap-2 rounded-md border border-acln bg-panel py-[5px] pr-1.5 pl-2.5 text-xs">
              <Search size={13} className="text-ac" />
              <span>{highlight.label}</span>
              <span className="font-mono text-[10.5px] text-tx3">{highlight.hideOthers ? 'le altre sono nascoste' : 'le altre sono attenuate'}</span>
              <button type="button" onClick={() => setHighlight(null)} className="flex items-center gap-1 text-tx3 hover:text-tx">
                <Kbd>Esc</Kbd>
                <X size={12} />
              </button>
            </div>
          </Panel>
        )}
        {!highlight && path && pathColor && (
          <Panel position="top-center" className="!mt-3.5">
            <div className="flex items-center gap-2 rounded-md border bg-panel py-[5px] pr-1.5 pl-2.5 text-xs" style={{ borderColor: pathColor }}>
              <span className="size-2 rounded-full" style={{ background: pathColor }} />
              Percorso decisivo verso <b className="font-semibold">{project.endings.find((e) => e.id === pathEndingId)?.label}</b>
              <span className="font-mono text-[10.5px] text-tx3">
                {path.sceneIds.size} scene · {path.linkIds.size} passaggi · {path.manualIds.size} segnati a mano
              </span>
              <button type="button" onClick={() => useUiStore.getState().setPathEnding(null)} className="text-tx3 hover:text-tx" title="Nascondi percorso">
                <X size={12} />
              </button>
            </div>
          </Panel>
        )}
        <Panel position="bottom-left" className="!m-4">
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-[3px] text-tx2">
            <button type="button" className="grid size-[26px] place-items-center hover:text-tx" onClick={() => flow.zoomOut()} title="Riduci">
              <Minus size={14} />
            </button>
            <span className="w-[42px] text-center font-mono text-[11px] font-medium text-tx">{Math.round(zoom * 100)}%</span>
            <button type="button" className="grid size-[26px] place-items-center hover:text-tx" onClick={() => flow.zoomIn()} title="Ingrandisci">
              <Plus size={14} />
            </button>
            <span className="h-4 w-px bg-line2" />
            <button
              type="button"
              className={`grid size-[26px] place-items-center hover:text-tx ${snapOn ? 'text-ac' : ''}`}
              onClick={() => useUiStore.getState().setPrefs({ snap: !snapOn })}
              title={`Aggancio dei nodi: ${snapOn ? 'attivo' : 'spento'} (Alt lo sospende)${kbdSnap ? ` · ${kbdSnap}` : ''}`}
            >
              <Magnet size={14} />
            </button>
            <button type="button" className="grid size-[26px] place-items-center hover:text-tx" onClick={() => flow.fitView({ padding: 0.15, duration: 200 })} title="Adatta il grafo alla finestra">
              <Scan size={14} />
            </button>
          </div>
        </Panel>
        <MiniMap<FlowNode>
          position="bottom-right"
          className="!m-4 !h-[132px] !w-[208px] overflow-hidden rounded-lg border border-line !bg-panel"
          style={{ width: 208, height: 132 }}
          pannable
          zoomable
          nodeBorderRadius={2}
          nodeColor={(n) =>
            n.type === 'sceneGroup' ? 'transparent' : n.type === 'collapsedGroup' ? 'var(--grpln)' : ((n as SceneFlowNode).data.ending?.color ?? TAG_COLOR[(n as SceneFlowNode).data.scene.tag])
          }
          nodeStrokeColor={(n) => (n.type === 'sceneGroup' ? 'var(--grpln)' : 'transparent')}
          maskColor="var(--acbg)"
          maskStrokeColor="var(--ac)"
          maskStrokeWidth={1.5}
          bgColor="var(--panel)"
        />
      </ReactFlow>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </>
  )
}
