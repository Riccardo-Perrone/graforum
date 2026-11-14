import { describe, expect, it } from 'vitest'
import { allFolders, createFolder, deleteFolder, folderNameError, mediaEntryPath, moveFolder } from './media'

describe('cartelle della libreria', () => {
  it('il percorso nel file segue la cartella', () => {
    expect(mediaEntryPath('image', { id: 'img_a', fileName: 'x.PNG' })).toBe('media/img_a.png')
    expect(mediaEntryPath('sound', { id: 'snd_a', fileName: 'x.mp3', folder: 'Musica/Taverna' })).toBe('sound/Musica/Taverna/snd_a.mp3')
  })

  it('rifiuta nomi che il file system non accetta', () => {
    expect(folderNameError('')).not.toBeNull()
    expect(folderNameError('a/b')).not.toBeNull()
    expect(folderNameError('..')).not.toBeNull()
    expect(folderNameError('Musica')).toBeNull()
  })

  it('crea cartelle annidate con gli antenati e senza duplicati', () => {
    const declared: string[] = []
    expect(createFolder(declared, [], 'Musica/Taverna').ok).toBe(true)
    expect(allFolders(declared, [])).toEqual(['Musica', 'Musica/Taverna'])
    expect(createFolder(declared, [], 'Musica').ok).toBe(false)
  })

  it('spostare una cartella porta con sé file e sottocartelle', () => {
    const items = [{ folder: 'A/B' }, { folder: 'A' }, { folder: '' }]
    const declared = ['A/C']
    expect(moveFolder(items, declared, 'A', 'Z/A').ok).toBe(true)
    expect(items.map((i) => i.folder)).toEqual(['Z/A/B', 'Z/A', ''])
    expect(declared).toContain('Z/A/C')
    expect(moveFolder(items, declared, 'Z', 'Z/A/Z').ok).toBe(false)
  })

  it('non sovrascrive una cartella esistente', () => {
    expect(moveFolder([{ folder: 'B' }], ['A'], 'A', 'B').ok).toBe(false)
  })

  it('eliminando una cartella il contenuto sale di livello', () => {
    const items = [{ folder: 'A/B/C' }, { folder: 'A/B' }, { folder: 'A' }]
    const declared = ['A/B', 'A/B/D']
    deleteFolder(items, declared, 'A/B')
    expect(items.map((i) => i.folder)).toEqual(['A/C', 'A', 'A'])
    expect(declared).toEqual(['A/D'])
  })
})
