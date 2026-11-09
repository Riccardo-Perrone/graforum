import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { sampleProject } from '@shared/sample/locanda-del-corvo'
import { backupBeforeMigration, readProjectFile, writeProjectFile, type ImageFiles } from './projectFile'

describe('file .dng', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'graforum-'))
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('salva e riapre il progetto identico', async () => {
    const path = join(dir, 'corvo.dng')
    await writeProjectFile(path, sampleProject(), new Map())
    expect((await readProjectFile(path)).project).toEqual(sampleProject())
  })

  it('salva solo le immagini in libreria e crea la copia .bak', async () => {
    const path = join(dir, 'corvo.dng')
    const project = { ...sampleProject(), images: [{ id: 'img_a', fileName: 'cantina.PNG', title: '', tags: [], mime: 'image/png', width: null, height: null }] }
    const images: ImageFiles = new Map([
      ['img_a', { data: new Uint8Array([1, 2, 3]), fileName: 'cantina.PNG' }],
      ['img_orfana', { data: new Uint8Array([9]), fileName: 'x.png' }]
    ])
    await writeProjectFile(path, project, images)
    await writeProjectFile(path, { ...project, name: 'Rinominato' }, images)

    const entries = unzipSync(new Uint8Array(await readFile(path)))
    expect(Object.keys(entries).sort()).toEqual(['images/img_a.png', 'project.json'])
    const reopened = await readProjectFile(path)
    expect(reopened.project.name).toBe('Rinominato')
    expect(reopened.images.get('img_a')?.data).toEqual(new Uint8Array([1, 2, 3]))
    expect((await readProjectFile(`${path}.bak`)).project.name).toBe('La locanda del Corvo')
  })

  it('rifiuta un file senza project.json', async () => {
    const path = join(dir, 'vuoto.dng')
    await writeFile(path, zipSync({ 'altro.txt': strToU8('x') }))
    await expect(readProjectFile(path)).rejects.toThrow('project.json')
  })

  it('un file corrente non risulta migrato', async () => {
    const path = join(dir, 'corvo.dng')
    await writeProjectFile(path, sampleProject(), new Map())
    expect((await readProjectFile(path)).migratedFrom).toBeNull()
  })

  it('rifiuta un file salvato da una versione più recente', async () => {
    const path = join(dir, 'futuro.dng')
    const project = { ...sampleProject(), schemaVersion: 999 }
    await writeFile(path, zipSync({ 'project.json': strToU8(JSON.stringify(project)) }))
    await expect(readProjectFile(path)).rejects.toThrow(/più recente/)
  })

  it('conserva una sola volta la copia dell’originale prima della migrazione', async () => {
    const path = join(dir, 'vecchio.dng')
    await writeFile(path, 'originale')
    expect(await backupBeforeMigration(path, 1)).toBe(`${path}.v1.bak`)
    await writeFile(path, 'riscritto')
    expect(await backupBeforeMigration(path, 1)).toBe(`${path}.v1.bak`)
    expect(await readFile(`${path}.v1.bak`, 'utf8')).toBe('originale')
  })
})
