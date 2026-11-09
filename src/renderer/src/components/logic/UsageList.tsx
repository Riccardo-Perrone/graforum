import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { buildUsageIndex, type EntityType, type Owner, type Project } from '@shared/model'
import { TYPE_NAMES } from '@shared/engine'
import { getProject, useProject } from '../../lib/entities'
import { openEntity, useUiStore } from '../../store/ui'
import { Button } from '../ui/form'
import { Sheet } from '../ui/Sheet'

const GROUP_LABEL: Partial<Record<EntityType, string>> = {
  scene: 'Scene',
  link: 'Collegamenti',
  dialog: 'Dialoghi',
  quest: 'Quest',
  npc: 'NPC',
  enemy: 'Enemy',
  item: 'Oggetti',
  encounter: 'Incontri',
  group: 'Gruppi',
  ending: 'Finali',
  document: 'Documenti',
  preset: 'Preset'
}

/** Scena da evidenziare per un proprietario (per l'hover sulle righe "Usato in"). */
function sceneOf(p: Project, o: Owner): string | null {
  if (o.type === 'scene') return o.id
  if (o.type === 'link') return p.links.find((l) => l.id === o.id)?.fromSceneId ?? null
  if (o.type === 'ending') return p.endings.find((e) => e.id === o.id)?.sceneId ?? null
  if (o.type === 'encounter') return p.scenes.find((s) => s.encounterIds.includes(o.id))?.id ?? null
  return null
}

export function useUsage(id: string): Owner[] {
  const p = useProject()
  return useMemo(() => buildUsageIndex(p).get(id) ?? [], [p, id])
}

/** Colonna "Usato in": riferimenti raggruppati per tipo, ognuno cliccabile. */
export function UsageList({ owners, limit }: { owners: Owner[]; limit?: number }) {
  const p = useProject()
  const [all, setAll] = useState(false)
  const groups = new Map<EntityType, Owner[]>()
  for (const o of owners) groups.set(o.type, [...(groups.get(o.type) ?? []), o])
  let shown = 0
  if (owners.length === 0) return <div className="text-[12px] text-tx3">Non è usato da nessuna parte.</div>
  return (
    <div className="flex flex-col gap-3">
      {[...groups.entries()].map(([type, list]) => (
        <div key={type} className="flex flex-col gap-0.5">
          <span className="px-2 text-[11.5px] text-tx3">
            {GROUP_LABEL[type] ?? TYPE_NAMES[type]} · {list.length}
          </span>
          {list.map((o) => {
            if (limit && !all && shown >= limit) return null
            shown++
            const scene = sceneOf(p, o)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  // Cliccando la riga può sparire (cambio schermata) senza mouseleave: l'evidenziazione va tolta qui.
                  useUiStore.getState().setHighlight(null)
                  openEntity(o.type, o.id)
                }}
                onMouseEnter={() => scene && useUiStore.getState().setHighlight({ sceneIds: new Set([scene]), label: o.label })}
                onMouseLeave={() => useUiStore.getState().setHighlight(null)}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <ChevronRight size={13} className="text-tx3 opacity-0 group-hover:opacity-100" />
              </button>
            )
          })}
        </div>
      ))}
      {limit && owners.length > limit && !all && (
        <button type="button" className="self-start px-2 text-[12px] text-ac hover:underline" onClick={() => setAll(true)}>
          Vedi tutto ({owners.length})
        </button>
      )}
    </div>
  )
}

/** Eliminazione bloccata: mostra dove l'entità è usata, così la si può scollegare prima. */
export function BlockedDeleteDialog({ name, owners, onClose }: { name: string; owners: Owner[]; onClose(): void }) {
  return (
    <Sheet level={2} category="Eliminazione bloccata" title={`«${name}» è ancora in uso`} width={560} height={560} onClose={onClose} footer={<span>Scollega i riferimenti e riprova</span>}>
      <div className="flex flex-col gap-4 p-5">
        <p className="m-0 text-tx2">Non si può eliminare un’entità usata altrove. Ecco dove compare: ogni voce apre il punto da modificare.</p>
        <UsageList owners={owners} />
        <Button className="self-end" onClick={onClose}>
          Chiudi
        </Button>
      </div>
    </Sheet>
  )
}

/** Proprietari che bloccano l'eliminazione di una scena (collegamenti e finali propri vengono rimossi con lei). */
export function sceneBlockers(id: string): Owner[] {
  const p = getProject()
  const owners = (buildUsageIndex(p).get(id) ?? []).filter((o) => {
    if (o.type === 'link') {
      const l = p.links.find((x) => x.id === o.id)
      // Basta che il collegamento tocchi la scena: viene eliminato con lei, salvo che altre sue parti la citino.
      return !(l && (l.fromSceneId === id || l.toSceneId === id))
    }
    return o.type !== 'ending' && o.type !== 'group'
  })
  if (p.startSceneId === id) owners.unshift({ type: 'project', id: p.id, label: 'Scena di partenza del progetto' })
  return owners
}
