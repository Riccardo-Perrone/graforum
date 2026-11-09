import { MarkerType } from '@xyflow/react'
import type { Condition, Project, Scene, SceneTag } from '@shared/model'
import type { CollapsedGroupFlowNode, GroupFlowNode } from './GroupNode'
import type { LinkFlowEdge } from './LinkEdge'
import { SCENE_NODE_WIDTH, type SceneFlowNode } from './SceneNode'

/** Altezza indicativa del nodo scena, usata per calcolare l'ingombro dei gruppi. */
export const SCENE_NODE_HEIGHT = 136
const GROUP_PAD = 28
const GROUP_PAD_TOP = 40

export type FlowNode = SceneFlowNode | GroupFlowNode | CollapsedGroupFlowNode

const countConditions = (c: Condition | null): number => (!c ? 0 : c.type === 'group' ? c.children.reduce((n, x) => n + countConditions(x), 0) : 1)

function sceneStats(scene: Scene) {
  const checks = scene.items.reduce((n, i) => n + i.checks.length, 0) + (scene.entryCheck ? 1 : 0)
  const conditions =
    countConditions(scene.access.condition) +
    scene.items.reduce((n, i) => n + countConditions(i.gate.condition), 0) +
    scene.npcs.reduce((n, p) => n + countConditions(p.gate.condition), 0)
  return { checks, effects: scene.entryEffects.length, conditions }
}

export function abbreviateSkill(name: string): string {
  return name.slice(0, 3).toUpperCase()
}

/** Gruppo e tutti i discendenti. */
export function groupDescendants(p: Project, groupId: string): Set<string> {
  const out = new Set([groupId])
  let added = true
  while (added) {
    added = false
    for (const g of p.groups) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) (out.add(g.id), (added = true))
  }
  return out
}

export function buildGraph(project: Project): { nodes: FlowNode[]; edges: LinkFlowEdge[] } {
  const images = new Map(project.images.map((i) => [i.id, i]))
  const endings = new Map(project.endings.map((e) => [e.sceneId, e]))
  const skills = new Map(project.settings.skills.map((s) => [s.id, s]))
  const items = new Map(project.items.map((i) => [i.id, i]))
  const shopNpcs = new Set(project.npcs.filter((n) => n.services.shop.length > 0).map((n) => n.id))

  // Gruppi collassati più esterni: le loro scene sono nascoste e rappresentate da una carta.
  const groupById = new Map(project.groups.map((g) => [g.id, g]))
  const collapsedAncestor = (groupId: string | null): string | null => {
    let found: string | null = null
    let g = groupId ? groupById.get(groupId) : undefined
    while (g) {
      if (g.collapsed) found = g.id
      g = g.parentId ? groupById.get(g.parentId) : undefined
    }
    return found
  }
  const sceneProxy = new Map<string, string>()
  for (const s of project.scenes) {
    const c = collapsedAncestor(s.groupId)
    if (c) sceneProxy.set(s.id, c)
  }
  const visibleScenes = project.scenes.filter((s) => !sceneProxy.has(s.id))

  const sceneNodes: SceneFlowNode[] = visibleScenes.map((scene) => ({
    id: scene.id,
    type: 'scene',
    position: scene.position,
    data: {
      scene,
      imageName: scene.imageId ? (images.get(scene.imageId)?.fileName ?? null) : null,
      labels: project.settings.sceneLabels.filter((l) => scene.labelIds.includes(l.id)),
      isStart: project.startSceneId === scene.id,
      ending: endings.get(scene.id) ?? null,
      isShop: scene.npcs.some((p) => shopNpcs.has(p.npcId)),
      exits: project.links.filter((l) => l.fromSceneId === scene.id || (l.bidirectional && l.toSceneId === scene.id)).length,
      dialogs: scene.npcs.reduce((n, p) => n + p.dialogs.length, 0),
      ...sceneStats(scene)
    }
  }))

  // Ingombro dei gruppi: dai più interni ai più esterni.
  type Box = { x1: number; y1: number; x2: number; y2: number }
  const boxes = new Map<string, Box>()
  const depth = (id: string | null, d = 0): number => {
    const g = id ? groupById.get(id) : undefined
    return g?.parentId ? depth(g.parentId, d + 1) : d
  }
  const ordered = [...project.groups].sort((a, b) => depth(b.id) - depth(a.id))
  for (const group of ordered) {
    const parts: Box[] = [
      ...project.scenes
        .filter((s) => s.groupId === group.id)
        .map((s) => ({ x1: s.position.x, y1: s.position.y, x2: s.position.x + SCENE_NODE_WIDTH, y2: s.position.y + SCENE_NODE_HEIGHT })),
      ...project.groups.filter((g) => g.parentId === group.id).flatMap((g) => boxes.get(g.id) ?? [])
    ]
    if (parts.length === 0) continue
    boxes.set(group.id, {
      x1: Math.min(...parts.map((p) => p.x1)) - GROUP_PAD,
      y1: Math.min(...parts.map((p) => p.y1)) - GROUP_PAD_TOP,
      x2: Math.max(...parts.map((p) => p.x2)) + GROUP_PAD,
      y2: Math.max(...parts.map((p) => p.y2)) + GROUP_PAD
    })
  }

  const scenesIn = (groupId: string) => {
    const ids = groupDescendants(project, groupId)
    return project.scenes.filter((s) => s.groupId && ids.has(s.groupId))
  }

  const groupNodes: FlowNode[] = ordered.reverse().flatMap((group): FlowNode[] => {
    const box = boxes.get(group.id)
    if (!box) return []
    // Un gruppo dentro un gruppo collassato non si disegna.
    if (collapsedAncestor(group.parentId)) return []
    const members = scenesIn(group.id)
    if (group.collapsed) {
      const tags: Record<SceneTag, number> = { neutral: 0, safe: 0, warning: 0 }
      members.forEach((s) => tags[s.tag]++)
      const memberIds = new Set(members.map((s) => s.id))
      return [
        {
          id: group.id,
          type: 'collapsedGroup',
          position: { x: box.x1 + GROUP_PAD, y: box.y1 + GROUP_PAD_TOP },
          data: {
            group,
            sceneCount: members.length,
            tags,
            exits: project.links.filter((l) => memberIds.has(l.fromSceneId) !== memberIds.has(l.toSceneId)).length
          }
        }
      ]
    }
    return [
      {
        id: group.id,
        type: 'sceneGroup',
        position: { x: box.x1, y: box.y1 },
        dragHandle: '.group-handle',
        selectable: false,
        focusable: false,
        zIndex: -1 - depth(group.id),
        data: { group, sceneCount: members.length, nested: group.parentId !== null, width: box.x2 - box.x1, height: box.y2 - box.y1 }
      }
    ]
  })

  const marker = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--line2)' }
  const endpoint = (sceneId: string) => sceneProxy.get(sceneId) ?? sceneId
  // Coppie andata/ritorno tra gli stessi nodi: i due tratti vanno scostati per non sovrapporsi.
  const pairs = new Set(project.links.map((l) => `${endpoint(l.fromSceneId)}>${endpoint(l.toSceneId)}`))
  const seen = new Set<string>()
  const edges: LinkFlowEdge[] = []
  for (const link of project.links) {
    const source = endpoint(link.fromSceneId)
    const target = endpoint(link.toSceneId)
    if (source === target) continue
    const collapsedEdge = source !== link.fromSceneId || target !== link.toSceneId
    if (collapsedEdge) {
      const key = `${source}>${target}`
      if (seen.has(key)) continue
      seen.add(key)
    }
    const condition = link.gate.condition
    const conditionLabel = !condition
      ? null
      : condition.type === 'hasItem'
        ? (items.get(condition.itemId)?.name.split(' ')[0] ?? 'Oggetto')
        : 'Condizione'
    const checkLabel = link.checks.length ? link.checks.map((c) => `${abbreviateSkill(skills.get(c.skillId)?.name ?? '?')} ${c.dc}`).join(' / ') : null
    edges.push({
      id: link.id,
      type: 'link',
      source,
      target,
      markerEnd: marker,
      markerStart: link.bidirectional ? marker : undefined,
      data: {
        link,
        checkLabel: collapsedEdge ? null : checkLabel,
        conditionLabel: collapsedEdge ? null : conditionLabel,
        parallel: pairs.has(`${target}>${source}`)
      }
    })
  }

  return { nodes: [...groupNodes, ...sceneNodes], edges }
}
