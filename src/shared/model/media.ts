// Cartelle della libreria (immagini e suoni). Il percorso di una cartella è "A/B/C" (vuoto = radice)
// e coincide con le cartelle dentro il `.foru` (`media/A/B/<id>.png`), così libreria ed esplora file mostrano lo stesso albero.

export type MediaKind = 'image' | 'sound'

/** Cartella radice di ciascun tipo dentro il `.foru` e nei pacchetti di esportazione. */
export const MEDIA_ROOT: Record<MediaKind, string> = { image: 'media', sound: 'sound' }

const FORBIDDEN = /[\/:*?"<>|\u0000-\u001f]/

/** Nome valido per una singola cartella (non vuoto, senza caratteri vietati dai file system, né "." / ".."). */
export function folderNameError(name: string): string | null {
  const n = name.trim()
  if (!n) return 'Il nome non può essere vuoto'
  if (n === '.' || n === '..' || /[. ]$/.test(n)) return 'Nome non valido'
  if (FORBIDDEN.test(n)) return 'Non usare \ / : * ? " < > |'
  return null
}

/** Percorso pulito: segmenti tagliati, vuoti scartati, separatore "/". */
export const cleanFolder = (path: string): string => path.split(/[\/]/).map((s) => s.trim()).filter(Boolean).join('/')

export const joinFolder = (parent: string, name: string): string => cleanFolder(`${parent}/${name}`)
export const parentFolder = (path: string): string => path.split('/').slice(0, -1).join('/')
export const baseFolder = (path: string): string => path.split('/').pop() ?? ''
/** `path` è `ancestor` o sta dentro di esso. */
export const isInside = (path: string, ancestor: string): boolean => path === ancestor || path.startsWith(`${ancestor}/`)

/** Tutte le cartelle note (dichiarate, con file, e i loro antenati), ordinate. */
export function allFolders(declared: readonly string[], used: readonly string[]): string[] {
  const out = new Set<string>()
  for (const f of [...declared, ...used]) {
    const parts = cleanFolder(f).split('/').filter(Boolean)
    for (let i = 1; i <= parts.length; i++) out.add(parts.slice(0, i).join('/'))
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'it'))
}

/** Sposta/rinomina la cartella `from` in `to`: sostituisce il prefisso in un percorso che le appartiene. */
export const reparent = (path: string, from: string, to: string): string => (isInside(path, from) ? cleanFolder(`${to}/${path.slice(from.length)}`) : path)

const extOf = (fileName: string) => fileName.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? ''

/** Percorso del file nel `.foru` e nei pacchetti: `media/<cartella>/<id>.<ext>`. */
export const mediaEntryPath = (kind: MediaKind, m: { id: string; fileName: string; folder?: string }): string =>
  [MEDIA_ROOT[kind], cleanFolder(m.folder ?? ''), `${m.id}${extOf(m.fileName)}`].filter(Boolean).join('/')

// ——— Operazioni sulle cartelle (si applicano a una bozza del progetto: elenco dei file + cartelle dichiarate) ———

export type FolderResult = { ok: true } | { ok: false; error: string }

/** Crea una cartella (e i suoi antenati) nell'elenco delle dichiarate. */
export function createFolder(declared: string[], used: string[], path: string): FolderResult {
  const p = cleanFolder(path)
  if (!p) return { ok: false, error: 'Il nome non può essere vuoto' }
  for (const seg of p.split('/')) {
    const err = folderNameError(seg)
    if (err) return { ok: false, error: err }
  }
  if (allFolders(declared, used).includes(p)) return { ok: false, error: 'Esiste già una cartella con questo nome' }
  declared.push(p)
  return { ok: true }
}

/**
 * Sposta o rinomina la cartella `from` in `to` (percorso completo): cambiano anche i file e le sottocartelle che contiene.
 * Non si può spostare dentro se stessa né su un percorso già esistente.
 */
export function moveFolder(items: { folder: string }[], declared: string[], from: string, to: string): FolderResult {
  const target = cleanFolder(to)
  if (!from || !target) return { ok: false, error: 'Percorso non valido' }
  if (target === from) return { ok: true }
  if (isInside(target, from)) return { ok: false, error: 'Una cartella non può stare dentro se stessa' }
  const name = baseFolder(target)
  const err = folderNameError(name)
  if (err) return { ok: false, error: err }
  if (allFolders(declared, items.map((i) => i.folder)).includes(target)) return { ok: false, error: 'Esiste già una cartella con questo nome' }
  for (const i of items) i.folder = reparent(i.folder, from, target)
  const moved = declared.map((d) => reparent(d, from, target))
  declared.splice(0, declared.length, ...moved)
  // La cartella di destinazione, anche se solo implicita, deve restare nell'elenco.
  if (!declared.includes(target)) declared.push(target)
  return { ok: true }
}

/** Elimina la cartella: il contenuto (file e sottocartelle) sale nella cartella superiore. */
export function deleteFolder(items: { folder: string }[], declared: string[], path: string): void {
  const parent = parentFolder(path)
  for (const i of items) if (isInside(i.folder, path)) i.folder = reparent(i.folder, path, parent)
  const kept = declared.filter((d) => d !== path).map((d) => (isInside(d, path) ? reparent(d, path, parent) : d)).filter(Boolean)
  declared.splice(0, declared.length, ...kept)
}

/** Percorso di una cartella e dei suoi antenati, dalla radice: "A/B" → ["A", "A/B"]. */
export const folderTrail = (path: string): string[] => path.split('/').filter(Boolean).map((_, i, a) => a.slice(0, i + 1).join('/'))
