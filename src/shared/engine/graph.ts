import type { Outcome } from '../model/logic'
import type { Project } from '../model/project'

// Analisi del grafo: transizioni tra scene, raggiungibilità, percorso decisivo dei finali.

export interface Transition {
  from: string
  to: string
  /** Collegamento che genera la transizione, se esiste. */
  linkId: string | null
}

const sceneTarget = (o: Outcome): string | null => (o.target?.type === 'scene' ? o.target.id : null)

export function transitions(p: Project): Transition[] {
  const out: Transition[] = []
  for (const l of p.links) {
    out.push({ from: l.fromSceneId, to: l.toSceneId, linkId: l.id })
    if (l.bidirectional) out.push({ from: l.toSceneId, to: l.fromSceneId, linkId: l.id })
    for (const c of l.checks) {
      const s = sceneTarget(c.success)
      const f = sceneTarget(c.failure)
      if (s && s !== l.toSceneId) out.push({ from: l.fromSceneId, to: s, linkId: l.id })
      if (f) out.push({ from: l.fromSceneId, to: f, linkId: l.id })
    }
  }
  for (const scene of p.scenes) {
    const outcomes: Outcome[] = [
      ...(scene.entryCheck ? [scene.entryCheck.success, scene.entryCheck.failure] : []),
      ...scene.items.flatMap((i) => i.checks.flatMap((c) => [c.success, c.failure])),
      ...scene.encounterIds.flatMap((id) => {
        const enc = p.encounters.find((e) => e.id === id)
        return enc ? [enc.outcomes.win, enc.outcomes.flee, enc.outcomes.defeat] : []
      })
    ]
    for (const o of outcomes) {
      const to = sceneTarget(o)
      if (to) out.push({ from: scene.id, to, linkId: null })
    }
  }
  return out
}

function closure(start: string[], next: Map<string, string[]>): Set<string> {
  const seen = new Set(start)
  const stack = [...start]
  while (stack.length) {
    const n = stack.pop()!
    for (const m of next.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m)
        stack.push(m)
      }
    }
  }
  return seen
}

function adjacency(ts: Transition[], reverse = false): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const t of ts) {
    const [a, b] = reverse ? [t.to, t.from] : [t.from, t.to]
    m.set(a, [...(m.get(a) ?? []), b])
  }
  return m
}

export function reachableFromStart(p: Project, ts = transitions(p)): Set<string> {
  return p.startSceneId ? closure([p.startSceneId], adjacency(ts)) : new Set()
}

export interface DecisivePath {
  sceneIds: Set<string>
  linkIds: Set<string>
  /** Collegamenti e scelte segnati a mano. */
  manualIds: Set<string>
}

/** Scene e collegamenti dalla partenza al finale: raggiungibili e da cui il finale è raggiungibile. */
export function decisivePath(p: Project, endingId: string): DecisivePath {
  const ending = p.endings.find((e) => e.id === endingId)
  const empty: DecisivePath = { sceneIds: new Set(), linkIds: new Set(), manualIds: new Set() }
  if (!ending) return empty
  const ts = transitions(p)
  const forward = reachableFromStart(p, ts)
  const backward = closure([ending.sceneId], adjacency(ts, true))
  const sceneIds = new Set([...forward].filter((id) => backward.has(id)))
  const linkIds = new Set(ts.filter((t) => t.linkId && sceneIds.has(t.from) && sceneIds.has(t.to)).map((t) => t.linkId!))
  return { sceneIds, linkIds, manualIds: new Set(ending.manualDecisive.map((m) => m.id)) }
}

/** Distanza (numero di passaggi) di ogni scena dalla partenza. */
export function distancesFromStart(p: Project): Map<string, number> {
  const dist = new Map<string, number>()
  if (!p.startSceneId) return dist
  const adj = adjacency(transitions(p))
  const queue = [p.startSceneId]
  dist.set(p.startSceneId, 0)
  while (queue.length) {
    const n = queue.shift()!
    for (const m of adj.get(n) ?? []) {
      if (!dist.has(m)) {
        dist.set(m, dist.get(n)! + 1)
        queue.push(m)
      }
    }
  }
  return dist
}
