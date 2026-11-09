import type { Project } from '../model'

// Elenco piatto di tutte le battute e scelte dei dialoghi, per la vista "Dialoghi".

export interface DialogEntry {
  /** Id della battuta o della scelta. */
  id: string
  kind: 'line' | 'choice'
  dialogId: string
  dialogTitle: string
  npcId: string
  /** Chi parla: nome dell'NPC, "Giocatore" o nome libero. */
  speaker: string
  text: string
  /** Scene in cui il dialogo è assegnato all'NPC. */
  sceneIds: string[]
}

export interface DialogFilter {
  npcId?: string | null
  sceneId?: string | null
  query?: string
}

export function listDialogEntries(p: Project): DialogEntry[] {
  const scenesOf = new Map<string, string[]>()
  for (const s of p.scenes)
    for (const n of s.npcs)
      for (const o of n.dialogs) {
        const list = scenesOf.get(o.dialogId) ?? []
        if (!list.includes(s.id)) list.push(s.id)
        scenesOf.set(o.dialogId, list)
      }
  const npcName = new Map(p.npcs.map((n) => [n.id, n.name]))
  return p.dialogs.flatMap((d) => {
    const base = { dialogId: d.id, dialogTitle: d.title, npcId: d.npcId, sceneIds: scenesOf.get(d.id) ?? [] }
    return d.lines.flatMap((l): DialogEntry[] => [
      {
        ...base,
        id: l.id,
        kind: 'line',
        speaker: l.speaker.kind === 'npc' ? (npcName.get(d.npcId) ?? 'NPC') : l.speaker.kind === 'player' ? 'Giocatore' : l.speaker.name,
        text: l.text
      },
      ...l.choices.map((c): DialogEntry => ({ ...base, id: c.id, kind: 'choice', speaker: 'Giocatore', text: c.text }))
    ])
  })
}

/** Filtra per NPC, scena e testo (senza distinguere maiuscole e accenti). */
export function filterDialogEntries(entries: DialogEntry[], f: DialogFilter): DialogEntry[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const q = norm((f.query ?? '').trim())
  return entries.filter(
    (e) => (!f.npcId || e.npcId === f.npcId) && (!f.sceneId || e.sceneIds.includes(f.sceneId)) && (!q || norm(e.text).includes(q))
  )
}

export interface DialogSummary {
  id: string
  title: string
  npcId: string
  sceneIds: string[]
  lineCount: number
  /** Battute e scelte che contengono il testo cercato (vuoto senza ricerca). */
  matches: DialogEntry[]
}

/** Dialoghi principali (uno per dialogo) che passano i filtri; la ricerca guarda titolo, battute e scelte. */
export function filterDialogs(p: Project, entries: DialogEntry[], f: DialogFilter): DialogSummary[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const q = norm((f.query ?? '').trim())
  const hits = filterDialogEntries(entries, { query: f.query })
  return p.dialogs.flatMap((d) => {
    const own = entries.filter((e) => e.dialogId === d.id)
    const sceneIds = own[0]?.sceneIds ?? p.scenes.filter((s) => s.npcs.some((n) => n.dialogs.some((o) => o.dialogId === d.id))).map((s) => s.id)
    if (f.npcId && d.npcId !== f.npcId) return []
    if (f.sceneId && !sceneIds.includes(f.sceneId)) return []
    const matches = q ? hits.filter((e) => e.dialogId === d.id) : []
    if (q && !matches.length && !norm(d.title).includes(q)) return []
    return [{ id: d.id, title: d.title, npcId: d.npcId, sceneIds, lineCount: d.lines.length, matches }]
  })
}
