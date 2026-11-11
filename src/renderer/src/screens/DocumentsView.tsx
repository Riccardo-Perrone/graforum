import { useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Bold, FileText, Heading1, Heading2, Italic, List, Plus, Quote, Trash2 } from 'lucide-react'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { Marked } from 'marked'
import { imageUrl } from '@shared/ipc'
import { DOC_LINK, newId, type EntityType, type Project } from '@shared/model'
import { entityName, TYPE_NAMES } from '@shared/engine'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { Combobox } from '../components/ui/Combobox'
import { Segmented, TextInput } from '../components/ui/form'
import { IconButton, Kbd, ToolbarButton, cn } from '../components/ui/primitives'
import { apply, useProject } from '../lib/entities'
import { openEntity, useUiStore } from '../store/ui'

// Documenti di progetto: Markdown libero con link alle entità `@[Testo](tipo:id)`.
// Nell'anteprima il passaggio del mouse mostra la scheda in miniatura, il clic apre l'entità.

const LINK = DOC_LINK

function allEntities(p: Project): { type: EntityType; id: string; label: string }[] {
  return [
    ...p.scenes.map((x) => ({ type: 'scene' as const, id: x.id, label: x.title })),
    ...p.npcs.map((x) => ({ type: 'npc' as const, id: x.id, label: x.name })),
    ...p.enemies.map((x) => ({ type: 'enemy' as const, id: x.id, label: x.name })),
    ...p.items.map((x) => ({ type: 'item' as const, id: x.id, label: x.name })),
    ...p.quests.map((x) => ({ type: 'quest' as const, id: x.id, label: x.title })),
    ...p.dialogs.map((x) => ({ type: 'dialog' as const, id: x.id, label: x.title })),
    ...p.encounters.map((x) => ({ type: 'encounter' as const, id: x.id, label: x.name })),
    ...p.groups.map((x) => ({ type: 'group' as const, id: x.id, label: x.name })),
    ...p.flags.map((x) => ({ type: 'flag' as const, id: x.id, label: x.name })),
    ...p.documents.map((x) => ({ type: 'document' as const, id: x.id, label: x.title }))
  ]
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Markdown → HTML: i link `@[Testo](tipo:id)` diventano chip; l'HTML grezzo viene mostrato come testo. */
export function renderMarkdown(md: string, p: Project): string {
  const parser = new Marked({ gfm: true, breaks: true })
  parser.use({
    renderer: {
      html: ({ text }) => escapeHtml(text),
      link({ href, tokens }) {
        const label = this.parser.parseInline(tokens)
        const m = /^entity:(\w+):([\w-]+)$/.exec(href)
        if (!m) return `<span class="ext-link">${label}</span>`
        const [, type, id] = m
        return `<a class="entity-link${type === 'enemy' || type === 'encounter' ? ' warn' : ''}" data-type="${type}" data-id="${id}">${label || escapeHtml(entityName(p, type as EntityType, id!))}</a>`
      }
    }
  })
  return parser.parse(md.replace(LINK, (_m, text: string, type: string, id: string) => `[${text}](entity:${type}:${id})`), { async: false }) as string
}

function HoverCard({ type, id, x, y }: { type: EntityType; id: string; x: number; y: number }) {
  const p = useProject()
  const detail = (() => {
    switch (type) {
      case 'scene': {
        const s = p.scenes.find((v) => v.id === id)
        return s && { img: s.imageId, sub: `Scena · ${s.tag}`, text: s.description }
      }
      case 'npc': {
        const n = p.npcs.find((v) => v.id === id)
        return n && { img: n.imageId, sub: `NPC · ${[n.role, n.race].filter(Boolean).join(' · ')}`, text: n.description }
      }
      case 'enemy': {
        const n = p.enemies.find((v) => v.id === id)
        return n && { img: n.imageId, sub: `Enemy · ${n.level} · PF ${n.hp ?? '—'} · CA ${n.ac ?? '—'}`, text: n.description }
      }
      case 'item': {
        const i = p.items.find((v) => v.id === id)
        return i && { img: i.imageId, sub: `Oggetto · ${p.settings.itemTypes.find((t) => t.id === i.typeId)?.name ?? ''}`, text: i.description }
      }
      case 'quest': {
        const q = p.quests.find((v) => v.id === id)
        return q && { img: null, sub: `Quest · ${q.steps.length} step`, text: q.description }
      }
      default:
        return { img: null, sub: TYPE_NAMES[type], text: '' }
    }
  })()
  return (
    <div className="pointer-events-none fixed z-[95] flex w-[300px] flex-col gap-2 rounded-[10px] border border-line2 bg-raised p-3 shadow-[var(--shadow)]" style={{ left: Math.min(x, window.innerWidth - 320), top: y + 14 }}>
      {detail?.img && <img src={imageUrl(detail.img)} alt="" className="aspect-video w-full rounded-md object-cover" />}
      <span className="font-mono text-[10px] font-semibold tracking-[.08em] text-tx3 uppercase">{detail?.sub ?? 'Entità eliminata'}</span>
      <span className="text-[14px] font-semibold">{entityName(p, type, id)}</span>
      {detail?.text && <span className="line-clamp-4 text-[12px] text-tx2">{detail.text}</span>}
      <span className="font-mono text-[10px] text-tx3">Clic per aprire</span>
    </div>
  )
}

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.25em', color: 'var(--tx)' },
  { tag: tags.heading2, fontWeight: '650', fontSize: '1.12em', color: 'var(--tx)' },
  { tag: tags.heading, fontWeight: '600', color: 'var(--tx)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.quote, color: 'var(--tx2)', fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--ac)' },
  { tag: tags.url, color: 'var(--tx3)' },
  { tag: tags.monospace, color: 'var(--safe)' },
  { tag: tags.processingInstruction, color: 'var(--tx3)' }
])

const theme = EditorView.theme({
  '&': { height: '100%', background: 'var(--bg)', color: 'var(--tx)', fontSize: '14px' },
  '.cm-content': { fontFamily: 'var(--font-mono)', lineHeight: '26px', padding: '16px 0', caretColor: 'var(--ac)' },
  '.cm-gutters': { background: 'var(--bg)', color: 'var(--tx3)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { background: 'var(--hover)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { background: 'var(--acbg) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--ac)' },
  '.cm-tooltip': { background: 'var(--raised)', border: '1px solid var(--line2)', borderRadius: '8px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'var(--acbg)', color: 'var(--tx)' },
  '.cm-scroller': { overflow: 'auto' },
  '&.cm-focused': { outline: 'none' }
})

function Editor({ docId, markdownText, onChange, editorRef }: { docId: string; markdownText: string; onChange(v: string): void; editorRef: React.MutableRefObject<EditorView | null> }) {
  const host = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const p = useProject()
  const entitiesRef = useRef(allEntities(p))
  entitiesRef.current = allEntities(p)

  useEffect(() => {
    // Completamento: "@" propone le entità del progetto.
    const complete = (ctx: CompletionContext) => {
      const word = ctx.matchBefore(/@[\p{L}\p{N}_ ]*/u)
      if (!word || (word.from === word.to && !ctx.explicit)) return null
      return {
        from: word.from,
        options: entitiesRef.current.map((e) => ({ label: `@${e.label}`, detail: TYPE_NAMES[e.type], apply: `@[${e.label}](${e.type}:${e.id})` }))
      }
    }
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: markdownText,
        extensions: [
          basicSetup,
          markdown(),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          placeholder('Scrivi qui. Digita @ per collegare scene, NPC, oggetti…'),
          autocompletion({ override: [complete] }),
          keymap.of([]),
          EditorView.updateListener.of((u) => u.docChanged && onChangeRef.current(u.state.doc.toString()))
        ]
      })
    })
    editorRef.current = view
    return () => {
      view.destroy()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  // Allinea l'editor quando il testo cambia da fuori (annulla/ripeti).
  useEffect(() => {
    const view = editorRef.current
    if (view && view.state.doc.toString() !== markdownText && !view.hasFocus) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdownText } })
    }
  }, [markdownText, editorRef])

  return <div ref={host} className="h-full min-h-0" />
}

function wrap(view: EditorView | null, before: string, after = before, linePrefix = false) {
  if (!view) return
  const { from, to } = view.state.selection.main
  if (linePrefix) {
    const line = view.state.doc.lineAt(from)
    view.dispatch({ changes: { from: line.from, insert: before } })
  } else {
    const text = view.state.sliceDoc(from, to)
    view.dispatch({ changes: { from, to, insert: `${before}${text}${after}` }, selection: { anchor: from + before.length, head: from + before.length + text.length } })
  }
  view.focus()
}

export function DocumentsView({ docId }: { docId: string | null }) {
  const p = useProject()
  const ui = useUiStore()
  const doc = p.documents.find((d) => d.id === docId) ?? p.documents[0]
  const [mode, setMode] = useState<'text' | 'split' | 'preview'>('split')
  const [hover, setHover] = useState<{ type: EntityType; id: string; x: number; y: number } | null>(null)
  const editorRef = useRef<EditorView | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const html = useMemo(() => (doc ? renderMarkdown(doc.markdown, p) : ''), [doc, p])
  const outline = useMemo(() => (doc ? doc.markdown.split('\n').flatMap((l, i) => (/^#{1,3} /.test(l) ? [{ level: l.indexOf(' '), text: l.replace(/^#+ /, ''), line: i + 1 }] : [])) : []), [doc])
  const links = useMemo(() => (doc ? [...doc.markdown.matchAll(LINK)].length : 0), [doc])

  const newDoc = () => {
    const id = newId('document')
    apply('Nuovo documento', (d) => void d.documents.push({ id, title: 'Nuovo documento', markdown: '# Nuovo documento\n\n', order: d.documents.length }))
    ui.setView({ kind: 'documents', docId: id })
  }

  const onChange = (text: string) => {
    if (!doc) return
    window.clearTimeout(timer.current)
    const id = doc.id
    timer.current = window.setTimeout(() => apply('Modifica documento', (d) => void (d.documents.find((x) => x.id === id)!.markdown = text), `doc-${id}`), 400)
  }

  const insertEntity = (type: EntityType, id: string) => {
    const view = editorRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: `@[${entityName(p, type, id)}](${type}:${id})` } })
    view.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-panel px-3 py-1">
        <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">DOCUMENTO</span>
        {doc && <TextInput className="h-7 w-[260px] font-semibold" value={doc.title} onCommit={(v) => v.trim() && apply('Titolo documento', (d) => void (d.documents.find((x) => x.id === doc.id)!.title = v.trim()))} />}
        <span className="mx-1 h-5 w-px bg-line2" />
        <IconButton icon={Heading1} title="Titolo 1" onClick={() => wrap(editorRef.current, '# ', '', true)} />
        <IconButton icon={Heading2} title="Titolo 2" onClick={() => wrap(editorRef.current, '## ', '', true)} />
        <IconButton icon={Bold} title="Grassetto" onClick={() => wrap(editorRef.current, '**')} />
        <IconButton icon={Italic} title="Corsivo" onClick={() => wrap(editorRef.current, '*')} />
        <IconButton icon={List} title="Elenco" onClick={() => wrap(editorRef.current, '- ', '', true)} />
        <IconButton icon={Quote} title="Citazione" onClick={() => wrap(editorRef.current, '> ', '', true)} />
        <span className="mx-1 h-5 w-px bg-line2" />
        <Combobox
          className="h-7 w-[220px]"
          value={null}
          placeholder="Inserisci @entità"
          icon={<AtSign size={13} className="text-ac" />}
          options={allEntities(p).map((e) => ({ id: `${e.type}:${e.id}`, label: e.label, sub: TYPE_NAMES[e.type] }))}
          onChange={(v) => {
            if (!v) return
            const [type, id] = v.split(':') as [EntityType, string]
            insertEntity(type, id)
          }}
        />
        <span className="flex-1" />
        <Segmented
          className="w-[260px]"
          value={mode}
          options={[
            ['text', 'Testo'],
            ['split', 'Diviso'],
            ['preview', 'Anteprima']
          ]}
          onChange={(v) => setMode(v as typeof mode)}
        />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] flex-none flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-3" data-text-scale>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">DOCUMENTI</span>
              <IconButton icon={Plus} size={13} title="Nuovo documento" onClick={newDoc} />
            </div>
            {p.documents.map((d) => (
              <div key={d.id} className={cn('group flex items-center gap-2 rounded-md px-2 py-1.5', d.id === doc?.id ? 'bg-acbg text-ac' : 'hover:bg-hover')}>
                <FileText size={13} className="flex-none" />
                <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => ui.setView({ kind: 'documents', docId: d.id })}>
                  {d.title}
                </button>
                <IconButton
                  icon={Trash2}
                  size={12}
                  className="opacity-0 group-hover:opacity-100"
                  title="Elimina documento"
                  onClick={async () => {
                    if (!(await confirmDialog({ title: `Eliminare il documento «${d.title}»?`, confirmLabel: 'Elimina documento' }))) return
                    apply('Elimina documento', (x) => void (x.documents = x.documents.filter((y) => y.id !== d.id)))
                    ui.setView({ kind: 'documents', docId: null })
                  }}
                />
              </div>
            ))}
            {p.documents.length === 0 && <span className="px-2 text-tx3">Nessun documento.</span>}
          </div>
          {outline.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="px-1 pb-1 font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">STRUTTURA</span>
              {outline.map((h) => (
                <button
                  key={h.line}
                  type="button"
                  className="truncate rounded-md px-2 py-1 text-left text-tx2 hover:bg-hover hover:text-tx"
                  style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                  onClick={() => {
                    const view = editorRef.current
                    if (!view) return
                    const line = view.state.doc.line(Math.min(h.line, view.state.doc.lines))
                    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
                    view.focus()
                  }}
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </aside>
        {doc ? (
          <>
            {mode !== 'preview' && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <Editor docId={doc.id} markdownText={doc.markdown} onChange={onChange} editorRef={editorRef} />
              </div>
            )}
            {mode !== 'text' && (
              <div
                className={cn('flex-none overflow-y-auto border-l border-line bg-panel px-8 py-6', mode === 'preview' ? 'flex-1' : 'w-[620px]')}
                data-text-scale
                onMouseOver={(e) => {
                  const a = (e.target as HTMLElement).closest('a.entity-link') as HTMLElement | null
                  if (a) setHover({ type: a.dataset.type as EntityType, id: a.dataset.id!, x: e.clientX, y: e.clientY })
                }}
                onMouseOut={(e) => (e.target as HTMLElement).closest('a.entity-link') && setHover(null)}
                onClick={(e) => {
                  const a = (e.target as HTMLElement).closest('a.entity-link') as HTMLElement | null
                  if (a) {
                    setHover(null)
                    openEntity(a.dataset.type as EntityType, a.dataset.id!)
                  }
                }}
              >
                <div className="mb-4 flex items-center justify-between font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">
                  <span>ANTEPRIMA</span>
                  <span>passa il mouse sui link · clic per aprire</span>
                </div>
                <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )}
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-tx3">
            <span className="flex flex-col items-center gap-2">
              Nessun documento.
              <ToolbarButton icon={Plus} variant="default" onClick={newDoc}>
                Nuovo documento
              </ToolbarButton>
            </span>
          </div>
        )}
      </div>
      <footer className="flex h-[26px] flex-none items-center gap-4 border-t border-line bg-panel px-3 font-mono text-[11px] text-tx3">
        <span>Markdown</span>
        <span>{links} link a entità</span>
        <span>{doc ? doc.markdown.split(/\s+/).filter(Boolean).length : 0} parole</span>
        <span className="flex-1" />
        <span>
          <Kbd>@</Kbd> collega un’entità
        </span>
      </footer>
      {hover && <HoverCard {...hover} />}
    </div>
  )
}
