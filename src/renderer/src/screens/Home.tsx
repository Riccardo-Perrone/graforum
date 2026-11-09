import { useState } from 'react'
import { BookOpen, FolderOpen, Plus } from 'lucide-react'
import { newProject, openProject, openRecent, openSample, readRecent } from '../lib/fileActions'
import { UpdateCard } from '../components/shell/UpdateCard'
import { Kbd } from '../components/ui/primitives'

/** Home progetti (7c): azioni a sinistra 360px, recenti a destra. */
export function Home() {
  const [recent] = useState(readRecent)

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[360px] flex-none flex-col gap-6 border-r border-line bg-panel p-8">
        <div className="size-6 scale-[.78] rotate-45 rounded-md bg-ac" />
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-[.12em] text-tx3">EDITOR DI GRAFO NARRATIVO</span>
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-.02em]">Struttura e contenuti della tua avventura.</h1>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={newProject}
            className="flex h-8 items-center gap-2 rounded-md bg-btn px-3 text-[12.5px] font-semibold text-btntx hover:opacity-90"
          >
            <Plus size={14} />
            Nuovo progetto
            <span className="ml-auto font-mono text-[10px] opacity-60">Ctrl N</span>
          </button>
          <button
            type="button"
            onClick={openProject}
            className="flex h-8 items-center gap-2 rounded-md border border-line2 px-3 text-[12.5px] font-medium text-tx hover:bg-hover"
          >
            <FolderOpen size={14} />
            Apri…
            <Kbd className="ml-auto">Ctrl O</Kbd>
          </button>
          <button
            type="button"
            onClick={openSample}
            className="flex h-8 items-center gap-2 rounded-md border border-line2 px-3 text-[12.5px] font-medium text-tx hover:bg-hover"
          >
            <BookOpen size={14} />
            Apri l’esempio
            <span className="ml-auto text-[11.5px] text-tx3">La locanda del Corvo</span>
          </button>
        </div>
        <UpdateCard className="mt-auto" />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-8">
        <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">RECENTI</span>
        {recent.length === 0 ? (
          <p className="m-0 text-tx3">Nessun progetto recente. Crea un nuovo progetto o apri l’esempio.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {recent.map((r) => (
              <button
                key={r.path}
                type="button"
                onClick={() => openRecent(r.path)}
                className="flex flex-col overflow-hidden rounded-[10px] border border-line2 bg-raised text-left hover:border-ac"
              >
                <span className="stripes h-[120px] border-b border-line" />
                <span className="flex flex-col gap-1 p-3">
                  <span className="font-semibold">{r.name}</span>
                  <span className="font-mono text-[10.5px] text-tx3">{r.scenes} scene</span>
                  <span className="truncate font-mono text-[10.5px] text-tx3">{r.path}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
