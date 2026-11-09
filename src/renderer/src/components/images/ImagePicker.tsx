import { useMemo, useState } from 'react'
import { Check, ImagePlus, Search, Trash2, Upload } from 'lucide-react'
import { imageUrl } from '@shared/ipc'
import { buildUsageIndex } from '@shared/model'
import { apply, useProject } from '../../lib/entities'
import { BlockedDeleteDialog } from '../logic/UsageList'
import { Button, TextInput } from '../ui/form'
import { Sheet } from '../ui/Sheet'
import { cn } from '../ui/primitives'

/** Miniatura di un'immagine della libreria, con segnaposto a righe se manca. */
export function ImageThumb({ id, className, rounded = 'rounded-lg', label }: { id: string | null; className?: string; rounded?: string; label?: string }) {
  const p = useProject()
  const img = id ? p.images.find((i) => i.id === id) : undefined
  return (
    <div className={cn('stripes relative overflow-hidden border border-line2', rounded, className)}>
      {img && <img src={imageUrl(img.id)} alt={img.title} className="absolute inset-0 size-full object-cover" draggable={false} />}
      {(label ?? img?.fileName) && <span className="absolute bottom-1.5 left-2 font-mono text-[9.5px] text-tx3 mix-blend-difference">{label ?? img?.fileName}</span>}
    </div>
  )
}

export async function importImages(): Promise<string[]> {
  const imported = await window.graforum.importImages()
  if (imported.length === 0) return []
  apply('Carica immagini', (d) => {
    for (const i of imported) d.images.push({ id: i.id, fileName: i.fileName, title: i.fileName.replace(/\.[^.]+$/, ''), tags: [], mime: i.mime, width: null, height: null })
  })
  return imported.map((i) => i.id)
}

/** Selettore immagini (6a): libreria con tag, ricerca, caricamento e scelta. */
export function ImagePicker({ value, onPick, onClose }: { value?: string | null; onPick?(id: string | null): void; onClose(): void }) {
  const p = useProject()
  const [selected, setSelected] = useState<string | null>(value ?? null)
  const [tag, setTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [blocked, setBlocked] = useState(false)
  const tags = useMemo(() => [...new Set(p.images.flatMap((i) => i.tags))].sort(), [p.images])
  const q = query.trim().toLowerCase()
  const shown = p.images.filter((i) => (!tag || i.tags.includes(tag)) && (!q || `${i.title} ${i.fileName} ${i.tags.join(' ')}`.toLowerCase().includes(q)))
  const current = p.images.find((i) => i.id === selected)
  const usage = current ? (buildUsageIndex(p).get(current.id) ?? []) : []

  const upload = async () => {
    const ids = await importImages()
    if (ids[0]) setSelected(ids[0])
  }

  return (
    <Sheet
      level={1}
      category="Libreria immagini"
      title={onPick ? 'Scegli un’immagine' : 'Immagini del progetto'}
      subtitle={`${p.images.length} immagini`}
      width={1240}
      height={900}
      onClose={onClose}
      bodyClassName="flex"
      footer={<span>Le immagini vengono copiate nel file .dng</span>}
    >
      <aside className="flex w-[220px] flex-none flex-col gap-1 overflow-y-auto border-r border-line p-3">
        <span className="px-2 pb-1 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">TAG</span>
        {[null, ...tags].map((t) => (
          <button
            key={t ?? '*'}
            type="button"
            onClick={() => setTag(t)}
            className={cn('flex justify-between rounded-md px-2 py-1.5 text-left hover:bg-hover', tag === t && 'bg-acbg text-ac')}
          >
            {t ?? 'Tutte'}
            <span className="font-mono text-[10.5px] text-tx3">{t ? p.images.filter((i) => i.tags.includes(t)).length : p.images.length}</span>
          </button>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <label className="flex h-[30px] flex-1 items-center gap-2 rounded-md border border-line2 bg-sunken px-2.5 text-tx3 focus-within:border-ac">
            <Search size={13} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome o tag" className="flex-1 bg-transparent text-tx outline-none" />
          </label>
          <Button onClick={upload}>
            <Upload size={14} />
            Carica
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-4 gap-3 overflow-y-auto p-3">
          <button type="button" onClick={upload} className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line2 text-tx3 hover:border-ac hover:text-ac">
            <ImagePlus size={20} />
            Carica nuova immagine
          </button>
          {shown.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelected(img.id)}
              onDoubleClick={() => {
                if (onPick) {
                  onPick(img.id)
                  onClose()
                }
              }}
              className="flex flex-col gap-1.5 text-left"
            >
              <span className={cn('relative block rounded-lg', selected === img.id && 'shadow-[0_0_0_2px_var(--ac)]')}>
                <ImageThumb id={img.id} className="aspect-video" label="" />
                {selected === img.id && (
                  <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-ac text-btntx">
                    <Check size={12} />
                  </span>
                )}
              </span>
              <span className="truncate text-[12px] font-medium">{img.title || img.fileName}</span>
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3 border-t border-line p-3">
          {current ? (
            <>
              <label className="flex w-[220px] flex-col gap-1 text-[11.5px] text-tx3">
                Titolo
                <TextInput value={current.title} onCommit={(title) => apply('Rinomina immagine', (d) => void (d.images.find((i) => i.id === current.id)!.title = title))} />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-[11.5px] text-tx3">
                Tag (separati da virgola)
                <TextInput
                  value={current.tags.join(', ')}
                  onCommit={(v) =>
                    apply('Tag immagine', (d) => {
                      d.images.find((i) => i.id === current.id)!.tags = v.split(',').map((t) => t.trim()).filter(Boolean)
                    })
                  }
                />
              </label>
              <span className="pb-2 font-mono text-[10.5px] text-tx3">
                {current.fileName} · usata {usage.length}×
              </span>
              <Button
                variant="ghost"
                title="Elimina dalla libreria"
                onClick={() => {
                  if (usage.length) return setBlocked(true)
                  apply('Elimina immagine', (d) => {
                    d.images = d.images.filter((i) => i.id !== current.id)
                  })
                  setSelected(null)
                }}
              >
                <Trash2 size={14} />
              </Button>
            </>
          ) : (
            <span className="flex-1 pb-2 text-tx3">Seleziona un’immagine per vederne i dettagli.</span>
          )}
          {onPick && (
            <div className="flex gap-2">
              {value && (
                <Button
                  onClick={() => {
                    onPick(null)
                    onClose()
                  }}
                >
                  Rimuovi immagine
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!selected}
                onClick={() => {
                  onPick(selected)
                  onClose()
                }}
              >
                Usa immagine
              </Button>
            </div>
          )}
        </div>
      </div>
      {blocked && current && <BlockedDeleteDialog name={current.title || current.fileName} owners={usage} onClose={() => setBlocked(false)} />}
    </Sheet>
  )
}
