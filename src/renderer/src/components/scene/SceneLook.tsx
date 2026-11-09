import { useState } from 'react'
import { Check, ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react'
import { imageUrl } from '@shared/ipc'
import { newId, type Scene, type SceneLabel } from '@shared/model'
import { apply, useProject } from '../../lib/entities'
import { LABEL_PALETTE, readableOn } from '../../lib/labels'
import { ImagePicker } from '../images/ImagePicker'
import { confirmDialog } from '../ui/ConfirmDialog'
import { Button, Field, Segmented, TextInput } from '../ui/form'
import { IconButton, cn } from '../ui/primitives'

function updateScene(id: string, label: string, recipe: (s: Scene) => void) {
  apply(label, (d) => recipe(d.scenes.find((s) => s.id === id)!))
}

/** Etichetta personalizzata: pillola del suo colore con il nome. */
export function LabelChip({ label, className }: { label: Pick<SceneLabel, 'name' | 'color'>; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-[18px] max-w-full items-center rounded-[4px] px-1.5 font-mono text-[9.5px] leading-none font-semibold tracking-[.06em] uppercase', className)}
      style={{ background: label.color, color: readableOn(label.color) }}
    >
      <span className="truncate">{label.name}</span>
    </span>
  )
}

/** Tavolozza di colori più un selettore libero. */
function Swatches({ value, onChange }: { value: string | null; onChange(c: string): void }) {
  const custom = !!value && !LABEL_PALETTE.includes(value)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LABEL_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={cn('size-6 rounded-md', value === c && 'shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--tx)]')}
          style={{ background: c }}
        />
      ))}
      <label title="Colore personalizzato" className={cn('relative size-6 cursor-pointer overflow-hidden rounded-md border border-dashed border-line2', custom && 'shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--tx)]')} style={custom ? { background: value } : undefined}>
        {!custom && <Plus size={12} className="absolute inset-0 m-auto text-tx3" />}
        <input type="color" value={value ?? '#4a6fe3'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
    </div>
  )
}

/** Etichette della scena: assegna quelle del progetto, ne crea e modifica di nuove (nome + colore). */
export function LabelsField({ scene }: { scene: Scene }) {
  const p = useProject()
  const labels = p.settings.sceneLabels
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(LABEL_PALETTE[0]!)
  const assigned = labels.filter((l) => scene.labelIds.includes(l.id))

  const toggle = (id: string) =>
    updateScene(scene.id, 'Etichette scena', (s) => void (s.labelIds = s.labelIds.includes(id) ? s.labelIds.filter((x) => x !== id) : [...s.labelIds, id]))
  const update = (id: string, recipe: (l: SceneLabel) => void) => apply('Modifica etichetta', (d) => recipe(d.settings.sceneLabels.find((l) => l.id === id)!), `label:${id}`)
  const create = () => {
    const n = name.trim()
    if (!n) return
    const id = newId('sceneLabel')
    apply('Nuova etichetta', (d) => {
      d.settings.sceneLabels.push({ id, name: n, color })
      d.scenes.find((s) => s.id === scene.id)!.labelIds.push(id)
    })
    setName('')
    setColor(LABEL_PALETTE[(labels.length + 1) % LABEL_PALETTE.length]!)
  }
  const remove = async (l: SceneLabel) => {
    const uses = p.scenes.filter((s) => s.labelIds.includes(l.id)).length
    const ok = await confirmDialog({
      title: `Eliminare l’etichetta «${l.name}»?`,
      detail: uses ? `Verrà tolta da ${uses} ${uses === 1 ? 'scena' : 'scene'}.` : undefined,
      confirmLabel: 'Elimina',
      danger: true
    })
    if (!ok) return
    apply('Elimina etichetta', (d) => {
      d.settings.sceneLabels = d.settings.sceneLabels.filter((x) => x.id !== l.id)
      for (const s of d.scenes) s.labelIds = s.labelIds.filter((x) => x !== l.id)
    })
  }

  return (
    <Field label="Etichette">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {assigned.map((l) => (
            <LabelChip key={l.id} label={l} className="h-6 px-2 text-[10.5px]" />
          ))}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={cn('flex h-6 items-center gap-1 rounded-[5px] border border-dashed border-line2 px-2 text-[11.5px] text-tx2 hover:bg-hover hover:text-tx', open && 'border-ac text-ac')}
          >
            <Plus size={12} />
            {assigned.length ? 'Modifica' : 'Aggiungi'}
          </button>
        </div>
        {open && (
          <div className="flex flex-col gap-2 rounded-lg border border-line2 p-2.5">
            {labels.map((l) => {
              const on = scene.labelIds.includes(l.id)
              return (
                <div key={l.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      className="flex h-7 min-w-0 flex-1 items-center justify-between rounded-md px-2.5 text-left text-[12px] font-semibold"
                      style={{ background: l.color, color: readableOn(l.color) }}
                    >
                      <span className="truncate">{l.name}</span>
                      {on && <Check size={13} />}
                    </button>
                    <IconButton icon={Pencil} size={12} title="Modifica nome e colore" className={cn(editing === l.id && 'bg-acbg text-ac')} onClick={() => setEditing(editing === l.id ? null : l.id)} />
                  </div>
                  {editing === l.id && (
                    <div className="flex flex-col gap-2 rounded-md bg-sunken p-2">
                      <div className="flex items-center gap-1.5">
                        <TextInput className="h-7 flex-1" value={l.name} onCommit={(v) => v.trim() && update(l.id, (x) => void (x.name = v.trim()))} />
                        <IconButton icon={Trash2} size={13} title="Elimina etichetta" onClick={() => remove(l)} />
                      </div>
                      <Swatches value={l.color} onChange={(c) => update(l.id, (x) => void (x.color = c))} />
                    </div>
                  )}
                </div>
              )
            })}
            <div className={cn('flex flex-col gap-2', labels.length > 0 && 'border-t border-line pt-2.5')}>
              <span className="text-[11.5px] text-tx3">Nuova etichetta</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && create()}
                  placeholder="Nome"
                  className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-sunken px-2.5 text-[12.5px] text-tx outline-none focus:border-ac"
                />
                <Button variant="primary" className="h-7 px-2.5" disabled={!name.trim()} onClick={create}>
                  Crea
                </Button>
              </div>
              <Swatches value={color} onChange={setColor} />
            </div>
          </div>
        )}
      </div>
    </Field>
  )
}

type CoverMode = 'none' | 'strip' | 'full'

/** Copertina della scena: colore o immagine, come fascia sopra la card o come card intera (stile Trello). */
export function CoverField({ scene }: { scene: Scene }) {
  const p = useProject()
  const [picking, setPicking] = useState(false)
  const cover = scene.cover
  const mode: CoverMode = cover?.size ?? 'none'
  const image = cover?.imageId ? p.images.find((i) => i.id === cover.imageId) : undefined
  const set = (recipe: (c: NonNullable<Scene['cover']>) => void, label = 'Copertina scena') =>
    updateScene(scene.id, label, (s) => {
      if (s.cover) recipe(s.cover)
    })

  return (
    <Field label="Copertina">
      <div className="flex flex-col gap-2.5">
        <Segmented
          value={mode}
          options={[
            ['none', 'Nessuna'],
            ['strip', 'Parziale'],
            ['full', 'Intera']
          ]}
          onChange={(m) =>
            updateScene(scene.id, 'Copertina scena', (s) => {
              if (m === 'none') s.cover = null
              else if (s.cover) s.cover.size = m
              else s.cover = { imageId: null, color: LABEL_PALETTE[5]!, size: m }
            })
          }
        />
        {cover && (
          <>
            <div
              className={cn('relative flex items-end overflow-hidden rounded-lg border border-line2 px-3 py-2', cover.size === 'full' ? 'h-[72px]' : 'h-10')}
              style={{ background: cover.color ?? 'var(--sunken)' }}
            >
              {image && <img src={imageUrl(image.id)} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />}
              {cover.size === 'full' && (
                <span className="relative text-[12px] font-semibold" style={{ color: image ? '#fff' : readableOn(cover.color ?? '#000'), textShadow: image ? '0 1px 3px #000a' : undefined }}>
                  {scene.title}
                </span>
              )}
            </div>
            <Swatches value={cover.color} onChange={(c) => set((x) => void (x.color = c))} />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setPicking(true)}>
                <ImageIcon size={14} />
                {image ? 'Cambia immagine' : 'Usa un’immagine'}
              </Button>
              {image && (
                <Button variant="ghost" title="Togli l’immagine" onClick={() => set((x) => void (x.imageId = null), 'Togli immagine copertina')}>
                  <X size={14} />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      {picking && <ImagePicker value={cover?.imageId} onPick={(id) => set((x) => void (x.imageId = id))} onClose={() => setPicking(false)} />}
    </Field>
  )
}
