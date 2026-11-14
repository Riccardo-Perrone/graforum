import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { sampleProject } from '@shared/sample/locanda-del-corvo'
import { readProjectFile, writeProjectFile, type ImageFiles } from './projectFile'

describe('file .foru', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'graforum-'))
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('salva e riapre il progetto identico', async () => {
    const path = join(dir, 'corvo.foru')
    await writeProjectFile(path, sampleProject(), new Map())
    expect((await readProjectFile(path)).project).toEqual(sampleProject())
  })

  it('salva solo le immagini in libreria e crea la copia .bak', async () => {
    const path = join(dir, 'corvo.foru')
    const project = { ...sampleProject(), images: [{ id: 'img_a', fileName: 'cantina.PNG', title: '', tags: [], mime: 'image/png', folder: '', width: null, height: null }] }
    const images: ImageFiles = new Map([
      ['img_a', { data: new Uint8Array([1, 2, 3]), fileName: 'cantina.PNG' }],
      ['img_orfana', { data: new Uint8Array([9]), fileName: 'x.png' }]
    ])
    await writeProjectFile(path, project, images)
    await writeProjectFile(path, { ...project, name: 'Rinominato' }, images)

    const entries = unzipSync(new Uint8Array(await readFile(path)))
    expect(Object.keys(entries).sort()).toEqual(['media/img_a.png', 'project.json'])
    const reopened = await readProjectFile(path)
    expect(reopened.project.name).toBe('Rinominato')
    expect(reopened.images.get('img_a')?.data).toEqual(new Uint8Array([1, 2, 3]))
    expect((await readProjectFile(`${path}.bak`)).project.name).toBe('La locanda del Corvo')
  })

  it('salva e riapre i suoni sotto sound/, scartando quelli fuori libreria', async () => {
    const path = join(dir, 'corvo.foru')
    const project = { ...sampleProject(), sounds: [{ id: 'snd_a', fileName: 'taverna.MP3', title: 'Taverna', tags: ['musica'], mime: 'audio/mpeg', folder: '' }] }
    const files: ImageFiles = new Map([
      ['snd_a', { data: new Uint8Array([7, 8]), fileName: 'taverna.MP3' }],
      ['snd_orfano', { data: new Uint8Array([9]), fileName: 'x.wav' }]
    ])
    await writeProjectFile(path, project, files)
    expect(Object.keys(unzipSync(new Uint8Array(await readFile(path)))).sort()).toEqual(['project.json', 'sound/snd_a.mp3'])
    const reopened = await readProjectFile(path)
    expect(reopened.project.sounds[0]?.title).toBe('Taverna')
    expect(reopened.images.get('snd_a')?.data).toEqual(new Uint8Array([7, 8]))
    expect(reopened.images.has('snd_orfano')).toBe(false)
  })

  it('le cartelle della libreria diventano cartelle nel file, anche quelle vuote, e si riaprono uguali', async () => {
    const path = join(dir, 'corvo.foru')
    const project = {
      ...sampleProject(),
      sounds: [{ id: 'snd_a', fileName: 'taverna.mp3', title: 'Taverna', tags: [], mime: 'audio/mpeg', folder: 'Musica/Taverna' }],
      soundFolders: ['Effetti'],
      images: [{ id: 'img_a', fileName: 'x.png', title: '', tags: [], mime: 'image/png', folder: 'Mappe', width: null, height: null }]
    }
    const files: ImageFiles = new Map([
      ['snd_a', { data: new Uint8Array([1]), fileName: 'taverna.mp3' }],
      ['img_a', { data: new Uint8Array([2]), fileName: 'x.png' }]
    ])
    await writeProjectFile(path, project, files)
    const names = Object.keys(unzipSync(new Uint8Array(await readFile(path)))).sort()
    expect(names).toContain('sound/Musica/Taverna/snd_a.mp3')
    expect(names).toContain('sound/Effetti/')
    expect(names).toContain('media/Mappe/img_a.png')
    const reopened = await readProjectFile(path)
    expect(reopened.project.sounds[0]?.folder).toBe('Musica/Taverna')
    expect(reopened.project.soundFolders).toEqual(['Effetti'])
    expect(reopened.images.get('snd_a')?.data).toEqual(new Uint8Array([1]))
    expect(reopened.images.get('img_a')?.data).toEqual(new Uint8Array([2]))
  })

  it('salva e riapre le miniature delle immagini sotto thumbs/', async () => {
    const path = join(dir, 'corvo.foru')
    const project = { ...sampleProject(), images: [{ id: 'img_a', fileName: 'x.png', title: '', tags: [], mime: 'image/png', folder: '', width: null, height: null }] }
    const files: ImageFiles = new Map([['img_a', { data: new Uint8Array([2]), fileName: 'x.png', thumb: { data: new Uint8Array([3, 3]), mime: 'image/png' as const } }]])
    await writeProjectFile(path, project, files)
    expect(Object.keys(unzipSync(new Uint8Array(await readFile(path)))).sort()).toEqual(['media/img_a.png', 'project.json', 'thumbs/img_a.png'])
    const reopened = await readProjectFile(path)
    expect(reopened.images.get('img_a')?.thumb).toEqual({ data: new Uint8Array([3, 3]), mime: 'image/png' })
  })

  it('un .foru senza miniature si apre e l immagine usa l originale', async () => {
    const path = join(dir, 'corvo.foru')
    const project = { ...sampleProject(), images: [{ id: 'img_a', fileName: 'x.png', title: '', tags: [], mime: 'image/png', folder: '', width: null, height: null }] }
    await writeProjectFile(path, project, new Map([['img_a', { data: new Uint8Array([2]), fileName: 'x.png' }]]))
    expect((await readProjectFile(path)).images.get('img_a')?.thumb).toBeUndefined()
  })

  it('rifiuta un file senza project.json', async () => {
    const path = join(dir, 'vuoto.foru')
    await writeFile(path, zipSync({ 'altro.txt': strToU8('x') }))
    await expect(readProjectFile(path)).rejects.toThrow('project.json')
  })

  it('rifiuta un file salvato da una versione più recente', async () => {
    const path = join(dir, 'futuro.foru')
    const project = { ...sampleProject(), schemaVersion: 999 }
    await writeFile(path, zipSync({ 'project.json': strToU8(JSON.stringify(project)) }))
    await expect(readProjectFile(path)).rejects.toThrow(/più recente/)
  })
})
