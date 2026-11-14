import { readFile, rename, copyFile, writeFile, access } from 'node:fs/promises'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { MEDIA_ROOT, Project, cleanFolder, loadProject, mediaEntryPath } from '@shared/model'

// File `.foru`: zip con project.json e le cartelle media/ e sound/ (§2 di docs/modello-dati-v3.md).

const PROJECT_ENTRY = 'project.json'

/** Miniatura di un'immagine: salvata nel `.foru` come `thumbs/<id>.jpg|png` per non rifarla a ogni apertura. */
export type Thumb = { data: Uint8Array; mime: 'image/jpeg' | 'image/png' }
export const thumbEntryName = (id: string, mime: Thumb['mime']) => `thumbs/${id}.${mime === 'image/png' ? 'png' : 'jpg'}`

/**
 * Contenuto binario di immagini e suoni, per id (gli id hanno prefisso di tipo, quindi non si scontrano).
 * `thumb`: assente se non serve (immagine già piccola) o non si può fare (svg): si usa l'originale.
 */
export type ImageFiles = Map<string, { data: Uint8Array; fileName: string; thumb?: Thumb }>

type Media = { id: string; fileName: string; folder?: string }
export const imageEntryName = (m: Media) => mediaEntryPath('image', m)
export const soundEntryName = (m: Media) => mediaEntryPath('sound', m)

/** Le cartelle della libreria (anche vuote) diventano cartelle vere dentro lo zip. */
function folderEntries(kind: 'image' | 'sound', declared: string[], used: string[]): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const f of new Set([...declared, ...used].map(cleanFolder).filter(Boolean))) out[`${MEDIA_ROOT[kind]}/${f}/`] = new Uint8Array(0)
  return out
}

export async function readProjectFile(path: string): Promise<{ project: Project; images: ImageFiles }> {
  const entries = unzipSync(new Uint8Array(await readFile(path)))
  const json = entries[PROJECT_ENTRY]
  if (!json) throw new Error('Il file non contiene project.json')
  const project = loadProject(JSON.parse(strFromU8(json)))
  const images: ImageFiles = new Map()
  for (const img of project.images) {
    const data = entries[imageEntryName(img)]
    if (!data) continue
    const jpg = entries[thumbEntryName(img.id, 'image/jpeg')]
    const png = entries[thumbEntryName(img.id, 'image/png')]
    images.set(img.id, { data, fileName: img.fileName, ...(jpg ? { thumb: { data: jpg, mime: 'image/jpeg' as const } } : png ? { thumb: { data: png, mime: 'image/png' as const } } : {}) })
  }
  for (const snd of project.sounds) {
    const data = entries[soundEntryName(snd)]
    if (data) images.set(snd.id, { data, fileName: snd.fileName })
  }
  return { project, images }
}

/**
 * Scrittura atomica: file temporaneo + rinomina, con copia .bak del precedente.
 * Si salvano solo immagini e suoni ancora presenti nella libreria del progetto.
 */
export async function writeProjectFile(path: string, project: Project, images: ImageFiles): Promise<void> {
  const parsed = Project.parse(project)
  const entries: Record<string, Uint8Array> = { [PROJECT_ENTRY]: strToU8(JSON.stringify(parsed, null, 2)) }
  for (const img of parsed.images) {
    const file = images.get(img.id)
    if (!file) continue
    entries[imageEntryName(img)] = file.data
    if (file.thumb) entries[thumbEntryName(img.id, file.thumb.mime)] = file.thumb.data
  }
  for (const snd of parsed.sounds) {
    const file = images.get(snd.id)
    if (file) entries[soundEntryName(snd)] = file.data
  }
  Object.assign(entries, folderEntries('image', parsed.imageFolders, parsed.images.map((i) => i.folder)), folderEntries('sound', parsed.soundFolders, parsed.sounds.map((s) => s.folder)))
  if (await exists(path)) await copyFile(path, `${path}.bak`)
  const tmp = `${path}.tmp`
  await writeFile(tmp, zipSync(entries, { level: 6 }))
  await rename(tmp, path)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
