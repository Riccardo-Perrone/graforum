import { readFile, rename, copyFile, writeFile, access, constants } from 'node:fs/promises'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { Project, SCHEMA_VERSION, migrateProject } from '@shared/model'

// File `.dng`: zip con project.json e la cartella images/ (§2 di docs/modello-dati-v3.md).

const PROJECT_ENTRY = 'project.json'

/** Contenuto binario delle immagini, per id. */
export type ImageFiles = Map<string, { data: Uint8Array; fileName: string }>

export const imageEntryName = (id: string, fileName: string) => `images/${id}${fileName.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? ''}`

/** `migratedFrom`: versione del formato del file se è stato aggiornato in lettura, altrimenti null. */
export async function readProjectFile(path: string): Promise<{ project: Project; images: ImageFiles; migratedFrom: number | null }> {
  const entries = unzipSync(new Uint8Array(await readFile(path)))
  const json = entries[PROJECT_ENTRY]
  if (!json) throw new Error('Il file non contiene project.json')
  const { project, fromVersion } = migrateProject(JSON.parse(strFromU8(json)))
  const images: ImageFiles = new Map()
  for (const img of project.images) {
    const data = entries[imageEntryName(img.id, img.fileName)]
    if (data) images.set(img.id, { data, fileName: img.fileName })
  }
  return { project, images, migratedFrom: fromVersion < SCHEMA_VERSION ? fromVersion : null }
}

/**
 * Prima di riscrivere un file di una versione precedente ne conserva l'originale accanto, come `nome.dng.v1.bak`.
 * Non sovrascrive una copia già fatta. Restituisce il percorso della copia.
 */
export async function backupBeforeMigration(path: string, fromVersion: number): Promise<string | null> {
  const backup = `${path}.v${fromVersion}.bak`
  try {
    await copyFile(path, backup, constants.COPYFILE_EXCL)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') return null
  }
  return backup
}

/**
 * Scrittura atomica: file temporaneo + rinomina, con copia .bak del precedente.
 * Si salvano solo le immagini ancora presenti nella libreria del progetto.
 */
export async function writeProjectFile(path: string, project: Project, images: ImageFiles): Promise<void> {
  const parsed = Project.parse(project)
  const entries: Record<string, Uint8Array> = { [PROJECT_ENTRY]: strToU8(JSON.stringify(parsed, null, 2)) }
  for (const img of parsed.images) {
    const file = images.get(img.id)
    if (file) entries[imageEntryName(img.id, img.fileName)] = file.data
  }
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
