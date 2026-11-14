import { useMemo, useState } from 'react'
import { Braces, FileText, FolderOpen, Globe, OctagonX } from 'lucide-react'
import { blockingIssues, exportHtml, exportJson, scopeProject, type ExportOptions, type ExportScope } from '@shared/export/exporter'
import type { MediaRef } from '@shared/ipc'
import { options, useProject } from '../../lib/entities'
import { useProjectStore } from '../../store/project'
import { openEntity, useUiStore } from '../../store/ui'
import { Combobox } from '../ui/Combobox'
import { Button, Toggle } from '../ui/form'
import { cn } from '../ui/primitives'
import { Section, Sheet } from '../ui/Sheet'

type Format = 'json' | 'pdf' | 'html'

const FORMATS: [Format, typeof Braces, string, string][] = [
  ['json', Braces, 'JSON', 'Per il videogioco. Dati completi, id stabili.'],
  ['pdf', FileText, 'PDF', 'Per il tavolo. Documento stampabile con schede.'],
  ['html', Globe, 'HTML', 'Per il tavolo. Sfogliabile con link tra le scene.']
]

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'avventura'

/** Esportazione (7b): formato, ambito, opzioni, anteprima e cartella di destinazione. */
export function ExportSheet() {
  const p = useProject()
  const ui = useUiStore()
  const filePath = useProjectStore((s) => s.filePath)
  const [format, setFormat] = useState<Format>('json')
  const [scopeKind, setScopeKind] = useState<ExportScope['kind']>('all')
  const [groupId, setGroupId] = useState<string | null>(p.groups[0]?.id ?? null)
  const [opts, setOpts] = useState<ExportOptions>({ includeUsedCatalog: true, includeDocuments: false })
  const [withImages, setWithImages] = useState(true)
  const [done, setDone] = useState<string | null>(null)

  const scope: ExportScope = scopeKind === 'group' && groupId ? { kind: 'group', groupId } : scopeKind === 'catalogs' ? { kind: 'catalogs' } : { kind: 'all' }
  const blocking = useMemo(() => blockingIssues(p, scope), [p, scope.kind, groupId])
  const scoped = useMemo(() => scopeProject(p, scope, opts), [p, scope.kind, groupId, opts])
  const preview = useMemo(() => {
    if (format === 'json') return exportJson(p, scope, opts).split('\n').slice(0, 160).join('\n')
    return exportHtml(p, scope, opts, false)
      .replace(/<style>[\s\S]*?<\/style>/, '')
      .replace(/<(h[1-4])[^>]*>/g, '\n\n## ')
      .replace(/<li>/g, '\n• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
      .slice(0, 6000)
  }, [p, format, scope.kind, groupId, opts])

  const base = `${slug(p.name)}${scope.kind === 'group' ? `-${slug(p.groups.find((g) => g.id === groupId)?.name ?? 'gruppo')}` : scope.kind === 'catalogs' ? '-cataloghi' : ''}`
  const images: MediaRef[] = scoped.images.map((i) => ({ id: i.id, fileName: i.fileName, folder: i.folder }))
  // Anche i suoni viaggiano nel pacchetto del JSON (l'HTML non li usa).
  const jsonMedia: MediaRef[] = [...images, ...scoped.sounds.map((s): MediaRef => ({ id: s.id, fileName: s.fileName, folder: s.folder, kind: 'sound' }))]

  const run = async () => {
    let path: string | null = null
    if (format === 'json') {
      const json = exportJson(p, scope, opts)
      path =
        withImages && jsonMedia.length
          ? await window.graforum.exportZip(`${base}.zip`, { [`${base}.json`]: json }, jsonMedia)
          : await window.graforum.exportFile({ defaultName: `${base}.json`, filters: [{ name: 'JSON', extensions: ['json'] }], content: json })
    } else if (format === 'html') {
      const html = exportHtml(p, scope, opts, withImages)
      path =
        withImages && images.length
          ? await window.graforum.exportZip(`${base}.zip`, { 'index.html': html }, images)
          : await window.graforum.exportFile({ defaultName: `${base}.html`, filters: [{ name: 'HTML', extensions: ['html'] }], content: html })
    } else {
      path = await window.graforum.exportPdf(exportHtml(p, scope, opts, false), `${base}.pdf`)
    }
    if (path) setDone(path)
  }

  return (
    <Sheet
      category="Esportazione"
      title="Esporta l’avventura"
      width={1320}
      height={860}
      onClose={() => ui.openSheet(null)}
      bodyClassName="flex"
      footer={<span>{filePath ? `Progetto: ${filePath}` : 'Progetto non ancora salvato'}</span>}
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5" data-text-scale>
        <Section n={1} label="Formato">
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(([f, Icon, label, sub]) => (
              <button key={f} type="button" onClick={() => setFormat(f)} className={cn('flex flex-col gap-1.5 rounded-lg border p-3 text-left', format === f ? 'border-ac bg-acbg' : 'border-line2 hover:bg-hover')}>
                <Icon size={16} className={format === f ? 'text-ac' : 'text-tx3'} />
                <span className="font-semibold">{label}</span>
                <span className="text-[12px] text-tx3">{sub}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section n={2} label="Ambito">
          {(
            [
              ['all', 'Tutto il progetto', `${p.scenes.length} scene · ${p.npcs.length + p.enemies.length + p.items.length + p.quests.length} voci di catalogo`],
              ['group', 'Un gruppo', null],
              ['catalogs', 'Solo cataloghi', 'NPC, enemy, oggetti, quest, dialoghi, incontri']
            ] as const
          ).map(([k, label, sub]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5">
              <input type="radio" checked={scopeKind === k} onChange={() => setScopeKind(k)} className="accent-[var(--ac)]" />
              <span className="font-medium">{label}</span>
              {k === 'group' ? (
                <Combobox className="h-7 w-[260px]" value={groupId} options={options(p, 'group')} onChange={(id) => (setGroupId(id), setScopeKind('group'))} placeholder="Scegli un gruppo" />
              ) : (
                <span className="text-[12px] text-tx3">{sub}</span>
              )}
              {k === 'group' && scopeKind === 'group' && <span className="text-[12px] text-tx3">{scoped.scenes.length} scene</span>}
            </label>
          ))}
        </Section>
        <Section n={3} label="Opzioni">
          {scopeKind === 'group' && <Toggle checked={opts.includeUsedCatalog} onChange={(v) => setOpts({ ...opts, includeUsedCatalog: v })} label="Includi le voci di catalogo usate dal gruppo" />}
          {format !== 'pdf' && <Toggle checked={withImages} onChange={setWithImages} label="Copia le immagini in una cartella accanto" sub={`Pacchetto .zip con ${images.length} immagini${format === 'json' ? ` e ${scoped.sounds.length} suoni` : ''}`} />}
          <Toggle checked={opts.includeDocuments} onChange={(v) => setOpts({ ...opts, includeDocuments: v })} label="Includi le note dell’autore (documenti di progetto)" />
          {format === 'pdf' && <span className="text-[12px] text-tx3">Il PDF contiene i testi e le schede; le immagini restano nell’export HTML o JSON.</span>}
        </Section>
        {blocking.length > 0 && (
          <div className="my-3 flex flex-col gap-1.5 rounded-lg border border-err/60 bg-errbg p-3">
            <span className="flex items-center gap-1.5 font-semibold text-err">
              <OctagonX size={14} />
              {blocking.length} {blocking.length === 1 ? 'errore' : 'errori'} nell’ambito: l’esportazione non può procedere.
            </span>
            {blocking.slice(0, 5).map((i) => (
              <button key={i.id} type="button" className="text-left text-[12px] text-tx2 hover:underline" onClick={() => (ui.openSheet(null), openEntity(i.target.type, i.target.id))}>
                {i.title}: {i.detail}
              </button>
            ))}
          </div>
        )}
        {done && (
          <div className="my-3 flex items-center gap-2 rounded-lg border border-safe/50 bg-safebg p-3 text-[12.5px]">
            <span className="flex-1 truncate">Esportato in {done}</span>
            <Button className="h-7" onClick={() => void window.graforum.showItemInFolder(done)}>
              <FolderOpen size={13} />
              Mostra nella cartella
            </Button>
          </div>
        )}
        <div className="mt-auto flex justify-end gap-2 py-4">
          <Button onClick={() => ui.openSheet(null)}>Annulla</Button>
          <Button variant="primary" disabled={blocking.length > 0 || (scopeKind === 'group' && !groupId)} onClick={() => void run()}>
            Esporta {format.toUpperCase()}
          </Button>
        </div>
      </div>
      <aside className="flex w-[520px] flex-none flex-col border-l border-line bg-sunken">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">
          <span>ANTEPRIMA</span>
          <span>
            {base}.{format === 'json' ? 'json' : format}
          </span>
        </div>
        <pre className="m-0 min-h-0 flex-1 overflow-auto p-4 font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap text-tx2 select-text">{preview}</pre>
      </aside>
    </Sheet>
  )
}
