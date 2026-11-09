import { useMemo } from 'react'
import { FolderMinus, PanelLeft, PanelTop, Trash2 } from 'lucide-react'
import type { Group } from '@shared/model'
import { apply, options, useProject } from '../../lib/entities'
import { ungroup } from '../../lib/sceneOps'
import { dockBridge } from '../../dock/bridge'
import { useUiStore } from '../../store/ui'
import { groupDescendants } from '../graph/buildGraph'
import { EntityChip } from '../logic/EntityChip'
import { Combobox } from '../ui/Combobox'
import { Field, TextArea, TextInput, Toggle } from '../ui/form'
import { IconButton, cn } from '../ui/primitives'
import { Empty, Section, Sheet, SheetHeader } from '../ui/Sheet'
import { ENDING_PALETTE } from './SceneSheet'

function updateGroup(id: string, label: string, recipe: (g: Group) => void) {
  apply(label, (d) => {
    const g = d.groups.find((x) => x.id === id)
    if (g) recipe(g)
  })
}

function GroupTitle({ group }: { group: Group }) {
  return (
    <TextInput
      className="h-auto w-full border-transparent bg-transparent px-0 text-[22px] font-semibold focus:border-transparent focus:shadow-none"
      value={group.name}
      onCommit={(v) => v.trim() && updateGroup(group.id, 'Nome gruppo', (g) => void (g.name = v.trim()))}
    />
  )
}

function useGroupActions(group: Group, modal: boolean) {
  const ui = useUiStore()
  const actions = (
    <>
      <IconButton icon={FolderMinus} size={14} title="Sciogli gruppo (le scene restano)" onClick={() => (ungroup(group.id), ui.openSheet(null), ui.setSelectedGroup(null))} />
      {modal ? (
        <IconButton
          icon={PanelLeft}
          size={14}
          title="Aggancia al dock"
          onClick={() => {
            ui.openSheet(null)
            ui.setSelectedGroup(group.id)
            dockBridge.openPanel?.('inspector')
          }}
        />
      ) : (
        <IconButton icon={PanelTop} size={14} title="Apri in una finestra al centro" onClick={() => ui.openSheet({ kind: 'group', id: group.id })} />
      )}
    </>
  )
  return actions
}

/** Gruppo: nome, gruppo padre, più scene di entrata e di uscita, colore, stato collassato. */
export function GroupSheet({ id }: { id: string }) {
  const p = useProject()
  const group = p.groups.find((g) => g.id === id)
  if (!group) return null
  return <GroupWindow group={group} />
}

function GroupWindow({ group }: { group: Group }) {
  const p = useProject()
  const descendants = useMemo(() => groupDescendants(p, group.id), [p, group.id])
  const count = p.scenes.filter((s) => s.groupId && descendants.has(s.groupId)).length
  return (
    <Sheet category="Gruppo" title={<GroupTitle group={group} />} subtitle={`${count} scene`} actions={useGroupActions(group, true)} width={760} height={760} onClose={() => useUiStore.getState().openSheet(null)}>
      <GroupBody group={group} />
    </Sheet>
  )
}

/** Gruppo selezionato, nella stessa scheda della scena. */
export function DockedGroupPanel({ id }: { id: string }) {
  const group = useProject().groups.find((g) => g.id === id)
  if (!group)
    return (
      <div className="flex h-full min-h-0 flex-col bg-panel">
        <SheetHeader category="Gruppo" title="Gruppo eliminato" />
      </div>
    )
  return <DockedGroupInner group={group} />
}

function DockedGroupInner({ group }: { group: Group }) {
  const p = useProject()
  const descendants = useMemo(() => groupDescendants(p, group.id), [p, group.id])
  const count = p.scenes.filter((s) => s.groupId && descendants.has(s.groupId)).length
  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <SheetHeader category="Gruppo" title={<GroupTitle group={group} />} subtitle={`${count} scene`} actions={useGroupActions(group, false)} />
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <GroupBody group={group} />
      </div>
    </div>
  )
}

function GroupBody({ group }: { group: Group }) {
  const id = group.id
  const p = useProject()
  const descendants = useMemo(() => groupDescendants(p, id), [p, id])
  const members = p.scenes.filter((s) => s.groupId && descendants.has(s.groupId))
  const memberIds = new Set(members.map((s) => s.id))

  const SceneList = ({ field, label }: { field: 'entrySceneIds' | 'exitSceneIds'; label: string }) => (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        {group[field].map((sid) => (
          <span key={sid} className="flex items-center gap-0.5">
            <EntityChip type="scene" id={sid} />
            <IconButton icon={Trash2} size={11} onClick={() => updateGroup(id, label, (g) => void (g[field] = g[field].filter((x) => x !== sid)))} />
          </span>
        ))}
        <Combobox
          className="h-7 w-[200px]"
          value={null}
          placeholder="+ Aggiungi scena"
          options={options(p, 'scene', (sid) => memberIds.has(sid) && !group[field].includes(sid))}
          onChange={(sid) => sid && updateGroup(id, label, (g) => void g[field].push(sid))}
        />
      </div>
    </Field>
  )

  return (
    <>
      <div className="flex flex-col px-5" data-text-scale>
        <Section n={1} label="Descrizione">
          <TextArea rows={3} value={group.description} onCommit={(v) => updateGroup(id, 'Descrizione gruppo', (g) => void (g.description = v))} />
          <Field label="Gruppo padre" hint="per l’annidamento, es. Villaggio › Locanda">
            <Combobox
              allowClear
              placeholder="Nessuno (gruppo principale)"
              value={group.parentId}
              options={options(p, 'group', (gid) => !descendants.has(gid))}
              onChange={(pid) => updateGroup(id, 'Gruppo padre', (g) => void (g.parentId = pid))}
            />
          </Field>
        </Section>
        <Section n={2} label="Entrate e uscite">
          <SceneList field="entrySceneIds" label="Scene di entrata" />
          <SceneList field="exitSceneIds" label="Scene di uscita" />
        </Section>
        <Section n={3} label="Aspetto nel grafo">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => updateGroup(id, 'Colore gruppo', (g) => void (g.color = null))} className={cn('h-6 rounded-md border border-line2 px-2 text-[11px]', !group.color && 'border-ac text-ac')}>
              Neutro
            </button>
            {ENDING_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => updateGroup(id, 'Colore gruppo', (g) => void (g.color = c))} className={cn('size-6 rounded-md', group.color === c && 'shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--tx)]')} style={{ background: c }} />
            ))}
          </div>
          <Toggle checked={group.collapsed} label="Collassato" sub="Nel grafo diventa una carta unica; anche nella visualizzazione esportata" onChange={(v) => updateGroup(id, 'Collassa gruppo', (g) => void (g.collapsed = v))} />
        </Section>
        <Section n={4} label="Scene del gruppo">
          {members.length === 0 && <Empty>Nessuna scena.</Empty>}
          <div className="flex flex-wrap gap-1.5">
            {members.map((s) => (
              <EntityChip key={s.id} type="scene" id={s.id} />
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
