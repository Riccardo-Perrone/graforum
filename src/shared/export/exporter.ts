import { DOC_LINK, loadProject, mediaEntryPath, SCHEMA_VERSION, type Project, type Scene } from '../model'
import { describeCheck, describeCondition, describeEffect, entityName } from '../engine/describe'
import { findRefs } from '../engine/refs'
import { validate, type Issue } from '../engine/validate'

// Esportazione (§6 dei requisiti, 7b del design) e importazione JSON.

export type ExportScope = { kind: 'all' } | { kind: 'group'; groupId: string } | { kind: 'catalogs' }

export interface ExportOptions {
  /** Con l'ambito "gruppo": includi le voci di catalogo usate dalle scene del gruppo. */
  includeUsedCatalog: boolean
  /** Includi i documenti di progetto (note per il master). */
  includeDocuments: boolean
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = { includeUsedCatalog: true, includeDocuments: false }

function groupTree(p: Project, groupId: string): Set<string> {
  const ids = new Set([groupId])
  for (let added = true; added; ) {
    added = false
    for (const g of p.groups) if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) (ids.add(g.id), (added = true))
  }
  return ids
}

/** Sottoinsieme del progetto secondo l'ambito scelto. */
export function scopeProject(p: Project, scope: ExportScope, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS): Project {
  const docs = opts.includeDocuments ? p.documents : []
  if (scope.kind === 'all') return { ...p, documents: docs }
  if (scope.kind === 'catalogs')
    return { ...p, startSceneId: null, scenes: [], links: [], groups: [], endings: [], encounters: p.encounters, documents: docs, presets: [] }

  const groups = groupTree(p, scope.groupId)
  const scenes = p.scenes.filter((s) => s.groupId && groups.has(s.groupId))
  const sceneIds = new Set(scenes.map((s) => s.id))
  const links = p.links.filter((l) => sceneIds.has(l.fromSceneId) && sceneIds.has(l.toSceneId))
  const encounterIds = new Set(scenes.flatMap((s) => s.encounterIds))
  const encounters = p.encounters.filter((e) => encounterIds.has(e.id))
  const base: Project = {
    ...p,
    startSceneId: p.startSceneId && sceneIds.has(p.startSceneId) ? p.startSceneId : (p.groups.find((g) => g.id === scope.groupId)?.entrySceneIds[0] ?? null),
    scenes,
    links,
    groups: p.groups.filter((g) => groups.has(g.id)).map((g) => (g.id === scope.groupId ? { ...g, parentId: null } : g)),
    endings: p.endings.filter((e) => sceneIds.has(e.sceneId)),
    encounters,
    documents: docs,
    presets: []
  }
  if (!opts.includeUsedCatalog) return { ...base, npcs: [], enemies: [], items: [], quests: [], dialogs: [], images: [], sounds: [], flags: [] }

  // Voci di catalogo raggiunte dalle scene del gruppo (anche indirettamente: dialoghi → oggetti…).
  const used = new Set<string>()
  const queue: unknown[] = [...scenes, ...links, ...encounters]
  const lookup = new Map<string, unknown>([...p.npcs, ...p.enemies, ...p.items, ...p.quests, ...p.dialogs].map((e) => [e.id, e]))
  while (queue.length) {
    for (const r of findRefs(queue.pop())) {
      if (used.has(r.id)) continue
      used.add(r.id)
      const e = lookup.get(r.id)
      if (e) queue.push(e)
    }
  }
  // I dialoghi degli NPC inclusi.
  for (const d of p.dialogs) if (used.has(d.npcId) && !used.has(d.id)) (used.add(d.id), queue.push(d))
  while (queue.length) for (const r of findRefs(queue.pop())) if (!used.has(r.id)) (used.add(r.id), lookup.get(r.id) && queue.push(lookup.get(r.id)))
  return {
    ...base,
    npcs: p.npcs.filter((x) => used.has(x.id)),
    enemies: p.enemies.filter((x) => used.has(x.id)),
    items: p.items.filter((x) => used.has(x.id)),
    quests: p.quests.filter((x) => used.has(x.id)),
    dialogs: p.dialogs.filter((x) => used.has(x.id)),
    images: p.images.filter((x) => used.has(x.id)),
    sounds: p.sounds.filter((x) => used.has(x.id)),
    flags: p.flags.filter((x) => used.has(x.id))
  }
}

/** Errori che bloccano l'esportazione: solo quelli dentro l'ambito esportato. */
export function blockingIssues(p: Project, scope: ExportScope): Issue[] {
  const errors = validate(p).filter((i) => i.severity === 'error')
  if (scope.kind === 'all') return errors
  if (scope.kind === 'catalogs') return errors.filter((i) => ['npc', 'enemy', 'item', 'quest', 'dialog'].includes(i.target.type))
  const scoped = scopeProject(p, scope)
  const ids = new Set([...scoped.scenes, ...scoped.links, ...scoped.groups, ...scoped.endings].map((x) => x.id))
  return errors.filter((i) => ids.has(i.target.id) || (i.sceneId !== null && ids.has(i.sceneId)))
}

/** Rimuove i dati che servono solo all'editor (posizioni, stato collassato). */
function stripEditorData(p: Project) {
  return {
    ...p,
    scenes: p.scenes.map(({ position: _pos, ...s }) => s),
    groups: p.groups.map(({ collapsed: _c, ...g }) => g),
    dialogs: p.dialogs.map((d) => ({ ...d, lines: d.lines.map(({ position: _pos, ...l }) => l) }))
  }
}

export function exportJson(p: Project, scope: ExportScope, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS): string {
  const data = scopeProject(p, scope, opts)
  return JSON.stringify(
    {
      format: 'graforum-export',
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      scope,
      images: data.images.map((i) => ({ ...i, path: mediaEntryPath('image', i) })),
      sounds: data.sounds.map((s) => ({ ...s, path: mediaEntryPath('sound', s) })),
      project: stripEditorData(data)
    },
    null,
    2
  )
}

/**
 * Importa un JSON di Graforum: un export (`format: "graforum-export"`) o un project.json.
 * I dati solo-editor mancanti vengono ricostruiti (posizioni in griglia).
 */
export function importJson(text: string): Project {
  const raw = JSON.parse(text) as Record<string, unknown>
  const data = (raw['format'] === 'graforum-export' ? raw['project'] : raw) as Record<string, unknown>
  if (!data || typeof data !== 'object') throw new Error('Il file non contiene un progetto Graforum')
  const scenes = (Array.isArray(data['scenes']) ? data['scenes'] : []) as Record<string, unknown>[]
  scenes.forEach((s, i) => (s['position'] ??= { x: (i % 6) * 260, y: Math.floor(i / 6) * 220 }))
  const dialogs = (Array.isArray(data['dialogs']) ? data['dialogs'] : []) as { lines?: Record<string, unknown>[] }[]
  dialogs.forEach((d) => d.lines?.forEach((l, i) => (l['position'] ??= { x: i * 660, y: 0 })))
  return loadProject(data)
}

// ——— Documento leggibile (HTML, e da qui PDF) ———

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const para = (s: string) => (s.trim() ? s.split(/\n{2,}/).map((x) => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('') : '')
const TAG = { neutral: 'Neutral', safe: 'Safe', warning: 'Warning' }

function sceneHtml(p: Project, s: Scene, withImages: boolean): string {
  const ending = p.endings.find((e) => e.sceneId === s.id)
  const exits = p.links.filter((l) => l.fromSceneId === s.id || (l.bidirectional && l.toSceneId === s.id))
  const img = withImages && s.imageId ? p.images.find((i) => i.id === s.imageId) : undefined
  const parts: string[] = [
    `<section class="scene" id="${s.id}"><h3>${esc(s.title)} <span class="tag ${s.tag}">${TAG[s.tag]}</span>${p.startSceneId === s.id ? ' <span class="tag start">Partenza</span>' : ''}${ending ? ` <span class="tag" style="color:${ending.color};border-color:${ending.color}">${esc(ending.label)}</span>` : ''}</h3>`
  ]
  if (img) parts.push(`<img src="${mediaEntryPath('image', img)}" alt="">`)
  parts.push(para(s.description))
  if (s.access.condition) parts.push(`<p class="cond">Accesso: ${esc(describeCondition(p, s.access.condition))}</p>`)
  if (s.entryEffects.length) parts.push(`<p class="fx">All’ingresso: ${s.entryEffects.map((e) => esc(describeEffect(p, e))).join('; ')}</p>`)
  if (s.entryCheck) parts.push(`<p class="fx">Prova all’ingresso: ${esc(describeCheck(p, s.entryCheck))}</p>`)
  if (s.npcs.length)
    parts.push(
      `<h4>Personaggi</h4><ul>${s.npcs
        .map((n) => `<li><b>${esc(entityName(p, 'npc', n.npcId))}</b>${n.dialogs.length ? ` — dialoghi: ${n.dialogs.map((d) => `${esc(entityName(p, 'dialog', d.dialogId))}${d.gate.condition ? ` (se ${esc(describeCondition(p, d.gate.condition))})` : ''}`).join(', ')}` : ''}</li>`)
        .join('')}</ul>`
    )
  if (s.items.length)
    parts.push(
      `<h4>Oggetti</h4><ul>${s.items
        .map((i) => `<li>${esc(entityName(p, 'item', i.itemId))}${i.quantity > 1 ? ` ×${i.quantity}` : ''}${i.gate.condition ? ` — se ${esc(describeCondition(p, i.gate.condition))}` : ''}${i.checks.length ? ` — prova: ${i.checks.map((c) => esc(describeCheck(p, c))).join(' oppure ')}` : ''}</li>`)
        .join('')}</ul>`
    )
  for (const id of s.encounterIds) {
    const e = p.encounters.find((x) => x.id === id)
    if (!e) continue
    parts.push(
      `<div class="enc"><b>Incontro: ${esc(e.name)}</b> (${e.nature === 'repeatable' ? 'ripetibile' : 'unico'}) — ${e.enemies.map((x) => `${x.quantity} × ${esc(entityName(p, 'enemy', x.enemyId))}`).join(', ')}${e.rewards.xp ? ` · ${e.rewards.xp} PE` : ''}</div>`
    )
  }
  if (exits.length)
    parts.push(
      `<h4>Uscite</h4><ul>${exits
        .map((l) => {
          const to = l.fromSceneId === s.id ? l.toSceneId : l.fromSceneId
          return `<li>${esc(l.label || 'Prosegui')} → <a href="#${to}">${esc(entityName(p, 'scene', to))}</a>${l.gate.condition ? ` <span class="cond">(${esc(describeCondition(p, l.gate.condition))})</span>` : ''}${l.checks.length ? ` <span class="fx">prova: ${l.checks.map((c) => esc(describeCheck(p, c))).join(' oppure ')}</span>` : ''}</li>`
        })
        .join('')}</ul>`
    )
  parts.push('</section>')
  return parts.join('')
}

const CSS = `body{font:14px/1.6 'Segoe UI',system-ui,sans-serif;color:#15181d;max-width:860px;margin:32px auto;padding:0 24px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;border-bottom:2px solid #15181d;padding-bottom:4px;margin-top:36px}h3{font-size:16px;margin:24px 0 4px}h4{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#5b6270;margin:12px 0 2px}
.tag{font:600 10px monospace;border:1px solid #9aa1ad;border-radius:4px;padding:1px 5px;vertical-align:middle;text-transform:uppercase}.tag.safe{color:#0e8f78;border-color:#0e8f78}.tag.warning{color:#b56a00;border-color:#b56a00}.tag.start{color:#4257e8;border-color:#4257e8}
.cond{color:#4257e8}.fx{color:#0e8f78}.enc{border-left:3px solid #b56a00;padding:4px 10px;margin:8px 0;background:#fdf6ea}
.scene{page-break-inside:avoid;border-top:1px solid #e4e7ec;padding-top:4px}img{max-width:100%;border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #d3d8df;padding:3px 6px;text-align:left}.stat td{text-align:center}.muted{color:#737a88}`

export function exportHtml(p: Project, scope: ExportScope, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS, withImages = true): string {
  const d = scopeProject(p, scope, opts)
  const parts: string[] = [`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(d.name)}</title><style>${CSS}</style></head><body>`]
  parts.push(`<h1>${esc(d.name)}</h1>${para(d.description)}`)
  if (d.scenes.length) {
    parts.push('<h2>Scene</h2>')
    const byGroup = new Map<string | null, Scene[]>()
    for (const s of d.scenes) byGroup.set(s.groupId, [...(byGroup.get(s.groupId) ?? []), s])
    for (const [gid, scenes] of byGroup) {
      if (gid) {
        const g = d.groups.find((x) => x.id === gid)
        parts.push(`<h2>${esc(g?.name ?? 'Gruppo')}</h2>${para(g?.description ?? '')}`)
      }
      for (const s of scenes) parts.push(sceneHtml(d, s, withImages))
    }
  }
  if (d.npcs.length) {
    parts.push('<h2>Personaggi</h2>')
    for (const n of d.npcs)
      parts.push(
        `<h3>${esc(n.name)}</h3><p class="muted">${esc([n.race, n.role, n.faction, n.alignment].filter(Boolean).join(' · '))}</p>${para(n.description)}${statBlock(n)}${n.secrets ? `<p><b>Segreti:</b> ${esc(n.secrets)}</p>` : ''}${
          n.services.shop.length ? `<h4>Negozio</h4><ul>${n.services.shop.map((s) => `<li>${esc(entityName(d, 'item', s.itemId))} — ${s.price}</li>`).join('')}</ul>` : ''
        }`
      )
  }
  if (d.enemies.length) {
    parts.push('<h2>Avversari</h2>')
    for (const e of d.enemies) parts.push(`<h3>${esc(e.name)}</h3><p class="muted">${esc([e.size, e.creatureType, e.level].filter(Boolean).join(' · '))}</p>${para(e.description)}${statBlock(e)}`)
  }
  if (d.items.length) parts.push(`<h2>Oggetti</h2><table><tr><th>Nome</th><th>Tipo</th><th>Peso</th><th>Valore</th><th>Descrizione</th></tr>${d.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(entityName(d, 'itemType', i.typeId))}</td><td>${i.weight}</td><td>${i.value}</td><td>${esc(i.description)}</td></tr>`).join('')}</table>`)
  if (d.quests.length) {
    parts.push('<h2>Quest</h2>')
    for (const q of d.quests)
      parts.push(`<h3>${esc(q.title)}</h3>${para(q.description)}<ol>${q.steps.map((s) => `<li><b>${esc(s.title)}</b>${s.requirements ? ` — completo quando ${esc(describeCondition(d, s.requirements))}` : ''}${s.description ? `<br>${esc(s.description)}` : ''}</li>`).join('')}</ol>${q.rewards.xp ? `<p>Ricompensa: ${q.rewards.xp} PE</p>` : ''}`)
  }
  if (d.documents.length) {
    parts.push('<h2>Note per il master</h2>')
    for (const doc of d.documents) parts.push(`<h3>${esc(doc.title)}</h3><pre style="white-space:pre-wrap;font:inherit">${esc(doc.markdown.replace(DOC_LINK, '$1'))}</pre>`)
  }
  parts.push('</body></html>')
  return parts.join('')
}

function statBlock(c: Project['npcs'][number] | Project['enemies'][number]): string {
  const a = c.abilities
  const mod = (v: number) => `${v} (${v >= 10 ? '+' : ''}${Math.floor((v - 10) / 2)})`
  return `<table class="stat"><tr><th>FOR</th><th>DES</th><th>COS</th><th>INT</th><th>SAG</th><th>CAR</th><th>PF</th><th>CA</th><th>VEL</th></tr><tr><td>${mod(a.str)}</td><td>${mod(a.dex)}</td><td>${mod(a.con)}</td><td>${mod(a.int)}</td><td>${mod(a.wis)}</td><td>${mod(a.cha)}</td><td>${c.hp ?? '—'}</td><td>${c.ac ?? '—'}</td><td>${esc(c.speed || '—')}</td></tr></table>${
    c.attacks.length ? `<h4>Attacchi</h4><ul>${c.attacks.map((x) => `<li><b>${esc(x.name)}</b> +${x.bonus}, ${esc(x.damage)} ${esc(x.damageType)}${x.reach ? `, portata ${esc(x.reach)}` : ''}</li>`).join('')}</ul>` : ''
  }${c.traits.length ? `<h4>Tratti</h4><ul>${c.traits.map((t) => `<li><b>${esc(t.name)}.</b> ${esc(t.text)}</li>`).join('')}</ul>` : ''}`
}
