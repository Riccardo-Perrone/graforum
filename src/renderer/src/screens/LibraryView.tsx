import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { ChevronRight, Folder, FolderOpen, FolderPlus, ImagePlus, LayoutGrid, List, Music, PanelLeft, Pencil, Rows3, Trash2, Upload } from 'lucide-react'
import { MEDIA_ROOT, baseFolder, allFolders, buildUsageIndex, createFolder, deleteFolder, folderNameError, folderTrail, isInside, joinFolder, moveFolder, parentFolder, type FolderResult } from '@shared/model'
import { matchesAny } from '@shared/engine'
import { ImageThumb, importImages } from '../components/images/ImagePicker'
import { BlockedDeleteDialog } from '../components/logic/UsageList'
import { PlayButton, PlayerBar, importSounds } from '../components/sounds/SoundPlayer'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { Button, Segmented, Select, TextInput } from '../components/ui/form'
import { IconButton, cn } from '../components/ui/primitives'
import { SearchInput } from '../components/ui/SearchInput'
import { apply, useProject } from '../lib/entities'
import { usePlayer } from '../store/player'
import { useUiStore, type LibraryTab, type LibraryViewMode } from '../store/ui'

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'images', label: 'Media' },
  { id: 'sounds', label: 'Suoni' }
]

const parseTags = (v: string) => v.split(',').map((t) => t.trim()).filter(Boolean)

const DRAG_TYPE = 'application/x-graforum-media'
type Dragged = { kind: 'item'; id: string } | { kind: 'folder'; path: string }

/** Filtro per tag condiviso dalle due sezioni: elenco dei tag usati e conteggi. */
function TagFilter({ tags, counts, value, onChange }: { tags: string[]; counts: Map<string, number>; value: string | null; onChange(t: string | null): void }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[null, ...tags].map((t) => (
        <button
          key={t ?? '*'}
          type="button"
          onClick={() => onChange(t)}
          className={cn('flex items-center gap-1.5 rounded-md border border-line2 px-2 py-0.5 text-[12px] hover:bg-hover', value === t && 'border-ac bg-acbg text-ac')}
        >
          {t ?? 'Tutti'}
          <span className="font-mono text-[10px] text-tx3">{counts.get(t ?? '*') ?? 0}</span>
        </button>
      ))}
    </div>
  )
}

function tagCounts(lists: string[][]): { tags: string[]; counts: Map<string, number> } {
  const counts = new Map<string, number>([['*', lists.length]])
  for (const list of lists) for (const t of new Set(list)) counts.set(t, (counts.get(t) ?? 0) + 1)
  return { tags: [...counts.keys()].filter((k) => k !== '*').sort(), counts }
}

/** Campo per scrivere il nome di una cartella: Invio conferma, Esc annulla. */
function NameForm({ initial, label, error, onSubmit, onCancel }: { initial: string; label: string; error: string | null; onSubmit(name: string): void; onCancel(): void }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        aria-label={label}
        value={value}
        placeholder={label}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value)
          if (e.key === 'Escape') onCancel()
        }}
        className="h-[28px] w-48 rounded-md border border-line2 bg-sunken px-2.5 text-[12.5px] text-tx outline-none focus:border-ac"
      />
      <Button className="h-7 px-2" variant="primary" onClick={() => onSubmit(value)}>
        OK
      </Button>
      <Button className="h-7 px-2" variant="ghost" onClick={onCancel}>
        Annulla
      </Button>
      {error && <span className="text-[11.5px] text-err">{error}</span>}
    </div>
  )
}

/** Ciò che i due tipi di media hanno in comune. */
interface MediaItem {
  id: string
  title: string
  fileName: string
  mime: string
  tags: string[]
  folder: string
}

/** Anteprima: la miniatura dell'immagine, oppure una nota per i suoni. */
function Visual({ kind, id, large, className }: { kind: 'image' | 'sound'; id: string; large?: boolean; className?: string }) {
  if (kind === 'image') return <ImageThumb id={id} className={className} label="" thumb />
  return (
    <div className={cn('grid place-items-center rounded-lg border border-line2 bg-sunken text-tx3', className)}>
      <Music size={large ? 34 : 18} />
    </div>
  )
}

const ICON_VIEWS = [
  ['list', <List key="l" size={13} />],
  ['small', <Rows3 key="s" size={13} />],
  ['large', <LayoutGrid key="g" size={13} />]
] as const

/** Esplora risorse della libreria per un tipo di media: albero delle cartelle, tre viste, trascinamento per spostare. */
function MediaLibrary({ kind }: { kind: 'image' | 'sound' }) {
  const p = useProject()
  const view = useUiStore((s) => s.libraryView)
  const treeOpen = useUiStore((s) => s.libraryTree)
  const setPrefs = useUiStore((s) => s.setPrefs)
  const isImage = kind === 'image'
  const items: MediaItem[] = isImage ? p.images : p.sounds
  const declared = isImage ? p.imageFolders : p.soundFolders
  const noun = isImage ? 'media' : 'suono'
  const rootName = MEDIA_ROOT[kind]

  const [folder, setFolder] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [editor, setEditor] = useState<'new' | 'rename' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)

  const folders = useMemo(() => allFolders(declared, items.map((i) => i.folder)), [declared, items])
  // Se la cartella aperta sparisce (annulla, elimina) si torna alla radice.
  useEffect(() => {
    if (folder && !folders.includes(folder)) setFolder('')
  }, [folder, folders])

  const searching = query.trim() !== ''
  const inScope = items.filter((i) => (searching ? true : i.folder === folder))
  const { tags, counts } = useMemo(() => tagCounts(inScope.map((i) => i.tags)), [inScope])
  const shown = inScope.filter((i) => (!tag || i.tags.includes(tag)) && matchesAny(query, i.title, i.fileName, ...i.tags))
  const subfolders = searching ? [] : folders.filter((f) => parentFolder(f) === folder)
  const count = (f: string) => items.filter((i) => isInside(i.folder, f)).length

  const current = items.find((i) => i.id === selected)
  const usage = useMemo(() => (current ? (buildUsageIndex(p).get(current.id) ?? []) : []), [p, current])

  // Le operazioni sulle cartelle si provano prima su una copia: se falliscono non resta una voce vuota nella cronologia.
  const folderOp = (label: string, op: (items: { folder: string }[], declared: string[]) => FolderResult): boolean => {
    const probe = op(items.map((i) => ({ folder: i.folder })), [...declared])
    if (!probe.ok) {
      setError(probe.error)
      return false
    }
    setError(null)
    apply(label, (d) => void op((isImage ? d.images : d.sounds) as { folder: string }[], isImage ? d.imageFolders : d.soundFolders))
    return true
  }

  const submitName = (name: string) => {
    const err = folderNameError(name)
    if (err) return setError(err)
    if (editor === 'new') {
      const path = joinFolder(folder, name)
      if (folderOp('Nuova cartella', (_i, decl) => createFolder(decl, items.map((i) => i.folder), path))) {
        setEditor(null)
        setFolder(path)
      }
    } else if (editor === 'rename') {
      const to = joinFolder(parentFolder(folder), name)
      if (folderOp('Rinomina cartella', (it, decl) => moveFolder(it, decl, folder, to))) {
        setEditor(null)
        setFolder(to)
      }
    }
  }

  const removeFolder = async (path: string) => {
    const n = count(path)
    const detail = n ? `I ${n} file contenuti restano in libreria e salgono nella cartella superiore.` : 'La cartella è vuota.'
    if (!(await confirmDialog({ title: `Eliminare la cartella «${baseFolder(path)}»?`, detail, confirmLabel: 'Elimina cartella', danger: true }))) return
    apply('Elimina cartella', (d) => deleteFolder((isImage ? d.images : d.sounds) as { folder: string }[], isImage ? d.imageFolders : d.soundFolders, path))
    if (isInside(folder, path)) setFolder(parentFolder(path))
  }

  const moveItem = (id: string, target: string) => {
    if (items.find((i) => i.id === id)?.folder === target) return
    apply('Sposta in cartella', (d) => {
      const it = (isImage ? d.images : d.sounds).find((x) => x.id === id)
      if (it) it.folder = target
    })
  }

  const removeItem = async () => {
    if (!current) return
    if (usage.length) return setBlocked(true)
    if (!(await confirmDialog({ title: `Eliminare «${current.title || current.fileName}»?`, detail: `${isImage ? 'L’immagine esce' : 'Il suono esce'} dalla libreria e dal file del progetto.`, confirmLabel: 'Elimina', danger: true }))) return
    if (!isImage && usePlayer.getState().soundId === current.id) usePlayer.getState().stop()
    const id = current.id
    apply(`Elimina ${noun}`, (d) => {
      if (isImage) d.images = d.images.filter((i) => i.id !== id)
      else d.sounds = d.sounds.filter((i) => i.id !== id)
    })
    setSelected(null)
  }

  const upload = async () => {
    const ids = await (isImage ? importImages(folder) : importSounds(folder))
    if (ids[0]) {
      setSelected(ids[0])
      setQuery('')
    }
  }

  // Trascinamento: file e cartelle si lasciano su una cartella (albero, riquadri, percorso) o sulla radice.
  const dragStart = (e: DragEvent, d: Dragged) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(d))
    e.dataTransfer.effectAllowed = 'move'
  }
  const dropProps = (target: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      setDropOn(target)
    },
    onDragLeave: () => setDropOn((t) => (t === target ? null : t)),
    onDrop: (e: DragEvent) => {
      setDropOn(null)
      const raw = e.dataTransfer.getData(DRAG_TYPE)
      if (!raw) return
      e.preventDefault()
      const d = JSON.parse(raw) as Dragged
      if (d.kind === 'item') moveItem(d.id, target)
      else if (parentFolder(d.path) !== target) {
        const to = joinFolder(target, baseFolder(d.path))
        if (folderOp('Sposta cartella', (it, decl) => moveFolder(it, decl, d.path, to)) && isInside(folder, d.path)) setFolder(to)
      }
    }
  })
  const dropRing = (target: string) => dropOn === target && 'bg-acbg ring-1 ring-ac'

  const folderTile = (f: string) => {
    const Icon = folder === f ? FolderOpen : Folder
    if (view === 'list')
      return (
        <div key={f} draggable onDragStart={(e) => dragStart(e, { kind: 'folder', path: f })} {...dropProps(f)} className={cn('rounded-lg', dropRing(f))}>
          <button type="button" data-testid="folder-tile" onClick={() => setFolder(f)} className="flex w-full items-center gap-3 rounded-lg border border-line2 px-3 py-1.5 text-left hover:bg-hover">
            <Icon size={18} className="flex-none text-warn" />
            <span className="min-w-0 flex-1 truncate font-medium">{baseFolder(f)}</span>
            <span className="font-mono text-[10.5px] text-tx3">{count(f)}</span>
          </button>
        </div>
      )
    return (
      <div key={f} draggable onDragStart={(e) => dragStart(e, { kind: 'folder', path: f })} {...dropProps(f)} className={cn('rounded-lg', dropRing(f))}>
        <button type="button" data-testid="folder-tile" onClick={() => setFolder(f)} className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg p-2 hover:bg-hover">
          <Icon size={view === 'large' ? 56 : 34} strokeWidth={1.4} className="text-warn" />
          <span className="max-w-full truncate text-[12px] font-medium">{baseFolder(f)}</span>
          <span className="font-mono text-[10px] text-tx3">{count(f)}</span>
        </button>
      </div>
    )
  }

  const itemTile = (it: MediaItem) => {
    const sel = selected === it.id
    const common = { draggable: true, onDragStart: (e: DragEvent) => dragStart(e, { kind: 'item', id: it.id }) }
    const name = it.title || it.fileName
    if (view === 'list')
      return (
        <div
          key={it.id}
          data-testid="media-item"
          {...common}
          onClick={() => setSelected(it.id)}
          className={cn('flex cursor-pointer items-center gap-3 rounded-lg border border-line2 px-3 py-1.5 hover:bg-hover', sel && 'border-ac bg-acbg')}
        >
          {isImage ? <Visual kind={kind} id={it.id} className="h-8 w-12 flex-none" /> : <PlayButton id={it.id} />}
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          <span className="hidden min-w-0 max-w-[30%] flex-none truncate text-[11.5px] text-tx3 sm:block">{it.tags.join(', ')}</span>
          {searching && it.folder && <span className="flex-none truncate font-mono text-[10.5px] text-tx3">{it.folder}</span>}
        </div>
      )
    const large = view === 'large'
    return (
      <div key={it.id} data-testid="media-item" {...common} onClick={() => setSelected(it.id)} className="relative flex min-w-0 cursor-pointer flex-col gap-1.5 text-left">
        <span className={cn('block rounded-lg', sel && 'shadow-[0_0_0_2px_var(--ac)]')}>
          <Visual kind={kind} id={it.id} large={large} className={large ? (isImage ? 'aspect-video' : 'aspect-video') : 'aspect-square'} />
        </span>
        {!isImage && <PlayButton id={it.id} className="absolute left-1.5 top-1.5 bg-panel" />}
        <span className="truncate text-[12px] font-medium" title={name}>
          {name}
        </span>
      </div>
    )
  }

  const grid = view === 'large' ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(92px,1fr))]'
  const trail = folderTrail(folder)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <SearchInput className="min-w-[10rem] flex-1 basis-48" value={query} onChange={setQuery} placeholder="Cerca per nome o tag (in tutte le cartelle)" />
        <div data-testid="view-switch" className="flex-none">
          <Segmented<LibraryViewMode> value={view} options={ICON_VIEWS} onChange={(v) => setPrefs({ libraryView: v })} />
        </div>
        <Button data-testid="library-upload" onClick={() => void upload()}>
          <Upload size={14} />
          {isImage ? 'Carica immagini' : 'Carica suoni'}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className={cn('flex flex-none flex-col border-r border-line', treeOpen ? 'w-[190px]' : 'w-[44px]')}>
          <div className={cn('flex items-center gap-1 border-b border-line p-1.5', !treeOpen && 'flex-col')}>
            <IconButton
              icon={PanelLeft}
              size={15}
              data-testid="tree-toggle"
              className={cn('size-7 flex-none', treeOpen && 'bg-acbg text-ac')}
              title={treeOpen ? 'Comprimi l’albero delle cartelle' : 'Mostra l’albero delle cartelle'}
              onClick={() => setPrefs({ libraryTree: !treeOpen })}
            />
            <IconButton
              icon={FolderPlus}
              size={15}
              data-testid="new-folder"
              className="size-7 flex-none"
              title="Nuova cartella"
              onClick={() => {
                setError(null)
                setEditor('new')
              }}
            />
          </div>
          {treeOpen && (
            <nav aria-label="Cartelle" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2 text-[12.5px]">
              {['', ...folders].map((f) => {
                const depth = f ? f.split('/').length : 0
                const Icon = f === folder ? FolderOpen : Folder
                return (
                  <button
                    key={f || '/'}
                    type="button"
                    data-testid="folder-node"
                    draggable={f !== ''}
                    onDragStart={(e) => f && dragStart(e, { kind: 'folder', path: f })}
                    onClick={() => {
                      setFolder(f)
                      setEditor(null)
                      setError(null)
                    }}
                    {...dropProps(f)}
                    style={{ paddingLeft: 6 + depth * 12 }}
                    className={cn('flex items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-hover', f === folder && !searching && 'bg-acbg font-semibold text-ac', dropRing(f))}
                  >
                    <Icon size={14} className="flex-none" />
                    <span className="min-w-0 flex-1 truncate">{f ? baseFolder(f) : rootName}</span>
                    <span className="font-mono text-[10px] text-tx3">{f ? count(f) : items.length}</span>
                  </button>
                )
              })}
            </nav>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex min-h-7 flex-wrap items-center gap-x-1 gap-y-1">
            {searching ? (
              <span className="text-tx3">
                {shown.length} risultati in tutte le cartelle
              </span>
            ) : (
              <>
                <button type="button" {...dropProps('')} onClick={() => setFolder('')} className={cn('rounded px-1.5 py-0.5 hover:bg-hover', !folder && 'font-semibold', dropRing(''))}>
                  {rootName}
                </button>
                {trail.map((f) => (
                  <span key={f} className="flex items-center gap-1">
                    <ChevronRight size={12} className="text-tx3" />
                    <button type="button" {...dropProps(f)} onClick={() => setFolder(f)} className={cn('rounded px-1.5 py-0.5 hover:bg-hover', f === folder && 'font-semibold', dropRing(f))}>
                      {baseFolder(f)}
                    </button>
                  </span>
                ))}
                {folder && (
                  <span className="ml-2 flex items-center gap-0.5">
                    <IconButton
                      icon={Pencil}
                      size={13}
                      className="size-6"
                      title="Rinomina cartella"
                      onClick={() => {
                        setError(null)
                        setEditor('rename')
                      }}
                    />
                    <IconButton icon={Trash2} size={13} className="size-6" title="Elimina cartella" onClick={() => void removeFolder(folder)} />
                  </span>
                )}
              </>
            )}
          </div>
          {editor && <NameForm key={editor} initial={editor === 'rename' ? baseFolder(folder) : ''} label={editor === 'new' ? 'Nome della nuova cartella' : 'Nuovo nome'} error={error} onSubmit={submitName} onCancel={() => { setEditor(null); setError(null) }} />}
          {!editor && error && <span className="text-[12px] text-err">{error}</span>}
          <TagFilter tags={tags} counts={counts} value={tag} onChange={setTag} />
          <div className={cn(view === 'list' ? 'flex flex-col gap-1.5' : cn('grid auto-rows-min gap-3', grid))}>
            {subfolders.map(folderTile)}
            {shown.map(itemTile)}
          </div>
          {items.length === 0 && (
            <button
              type="button"
              onClick={() => void upload()}
              className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line2 text-tx3 hover:border-ac hover:text-ac"
            >
              {isImage ? <ImagePlus size={20} /> : <Music size={20} />}
              {isImage ? 'Carica la prima immagine' : 'Carica il primo suono (mp3, wav, ogg, m4a, flac…)'}
            </button>
          )}
          {items.length > 0 && shown.length === 0 && subfolders.length === 0 && <span className="text-tx3">{searching || tag ? 'Nessun risultato.' : 'Cartella vuota: trascina qui dei file o caricane di nuovi.'}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-line p-3">
        {current ? (
          <>
            <label className="flex min-w-[10rem] flex-1 basis-40 flex-col gap-1 text-[11.5px] text-tx3">
              Titolo
              <TextInput value={current.title} placeholder={current.fileName} onCommit={(title) => apply(`Rinomina ${noun}`, (d) => void ((isImage ? d.images : d.sounds).find((i) => i.id === current.id)!.title = title))} />
            </label>
            <label className="flex min-w-[10rem] flex-[2] basis-48 flex-col gap-1 text-[11.5px] text-tx3">
              Tag (separati da virgola)
              <TextInput value={current.tags.join(', ')} onCommit={(v) => apply(`Tag ${noun}`, (d) => void ((isImage ? d.images : d.sounds).find((i) => i.id === current.id)!.tags = parseTags(v)))} />
            </label>
            <label className="flex min-w-[9rem] flex-1 basis-36 flex-col gap-1 text-[11.5px] text-tx3">
              Cartella
              <Select value={current.folder} options={[['', rootName], ...folders.map((f): [string, string] => [f, f])]} onChange={(f) => moveItem(current.id, f)} />
            </label>
            <span className="pb-2 font-mono text-[10.5px] text-tx3">
              {current.fileName} · usato {usage.length}×
            </span>
            <IconButton icon={Trash2} size={14} className="mb-1 size-7" title="Elimina dalla libreria" onClick={() => void removeItem()} />
          </>
        ) : (
          <span className="pb-1 text-tx3">Seleziona {isImage ? 'un’immagine' : 'un suono'} per vederne i dettagli. Trascinala su una cartella per spostarla.</span>
        )}
      </div>
      {blocked && current && <BlockedDeleteDialog name={current.title || current.fileName} owners={usage} onClose={() => setBlocked(false)} />}
    </>
  )
}

/** Scheda Libreria: media (immagini) e suoni del progetto in cartelle; il player compare solo nella sezione Suoni. */
export function LibraryView({ tab: requested }: { tab: LibraryTab }) {
  const p = useProject()
  const [tab, setTab] = useState<LibraryTab>(requested)
  // Il menu o la ricerca possono chiedere una sezione mentre la scheda è già aperta.
  useEffect(() => setTab(requested), [requested])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-panel px-3 py-1.5">
        <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">LIBRERIA</span>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] hover:bg-hover', tab === t.id && 'bg-acbg font-semibold text-ac')}
          >
            {t.label}
            <span className="font-mono text-[10px] text-tx3">{t.id === 'images' ? p.images.length : p.sounds.length}</span>
          </button>
        ))}
      </div>
      <MediaLibrary key={tab} kind={tab === 'images' ? 'image' : 'sound'} />
      {tab === 'sounds' && (
        <div className="flex-none border-t border-line bg-panel p-3">
          <PlayerBar />
        </div>
      )}
    </div>
  )
}
