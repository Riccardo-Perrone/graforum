import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, ArrowRight, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Flag, ImageIcon, OctagonX, PanelLeft, PanelTop, Play, Swords, Trash2 } from 'lucide-react'
import { ENDING_COLORS, makeEnding, makeLink, newId, type Scene } from '@shared/model'
import { canLink, decisivePath, validateCached } from '@shared/engine'
import { apply, createEntity, emptyGate, options, useProject } from '../../lib/entities'
import { dockBridge } from '../../dock/bridge'
import { useUiStore } from '../../store/ui'
import { ImagePicker, ImageThumb } from '../images/ImagePicker'
import { EffectList } from '../logic/EffectEditor'
import { EntityChip } from '../logic/EntityChip'
import { ChecksButton, GateButton, newCheck } from '../logic/GateButton'
import { deleteScene, detachEncounter } from '../../lib/sceneOps'
import { useKbd } from '../../lib/commands'
import { playFromScene } from '../../lib/playtest'
import { SkillCheckEditor } from '../logic/EffectEditor'
import { Combobox } from '../ui/Combobox'
import { AddButton, Field, NumberInput, Segmented, TextArea, TextInput, Toggle } from '../ui/form'
import { DangerButton, IconButton, TAG_META, TagChip, cn } from '../ui/primitives'
import { EditHint, Empty, Row, Section, Sheet, SheetHeader } from '../ui/Sheet'
import { EncounterEditor } from './EncounterEditor'
import { CoverField, LabelsField } from './SceneLook'


export function updateScene(id: string, label: string, recipe: (s: Scene) => void, mergeKey?: string) {
  apply(label, (d) => recipe(d.scenes.find((s) => s.id === id)!), mergeKey)
}

/** Dialogo "solo contesto": senza effetti né prove. */
export function isContextOnly(p: ReturnType<typeof useProject>, dialogId: string) {
  const d = p.dialogs.find((x) => x.id === dialogId)
  return !!d && d.lines.every((l) => l.effects.length === 0 && l.choices.every((c) => c.effects.length === 0 && !c.check))
}

function SidePanel({ scene }: { scene: Scene }) {
  const p = useProject()
  const [picking, setPicking] = useState(false)
  const ending = p.endings.find((e) => e.sceneId === scene.id)
  const issues = useMemo(() => validateCached(p).filter((i) => i.sceneId === scene.id), [p, scene.id])
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ImageThumb id={scene.imageId} className="aspect-video" />
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="absolute right-2 bottom-2 flex h-7 items-center gap-1.5 rounded-md border border-line2 bg-panel px-2.5 text-[12px] font-medium hover:bg-hover"
        >
          <ImageIcon size={13} />
          Scegli o carica
        </button>
      </div>
      <Field label="Tag">
        <Segmented
          value={scene.tag}
          options={(['neutral', 'safe', 'warning'] as const).map((t) => {
            const Icon = TAG_META[t].icon
            return [t, <span key={t} className={cn('flex min-w-0 items-center gap-1 truncate font-mono text-[10px] font-semibold tracking-[.06em]', scene.tag === t && TAG_META[t].fg)}><Icon size={11} />{TAG_META[t].label}</span>] as const
          })}
          onChange={(tag) => updateScene(scene.id, 'Tag scena', (s) => void (s.tag = tag))}
        />
      </Field>
      <LabelsField scene={scene} />
      <CoverField scene={scene} />
      <Field label="Gruppo">
        <Combobox allowClear placeholder="Nessun gruppo" value={scene.groupId} options={options(p, 'group')} onChange={(groupId) => updateScene(scene.id, 'Gruppo scena', (s) => void (s.groupId = groupId))} />
      </Field>
      <div className="flex flex-col gap-3 rounded-lg border border-line2 p-3">
        <Toggle
          checked={p.startSceneId === scene.id}
          label="Scena di partenza"
          sub="Da qui inizia l’avventura"
          onChange={(v) => apply('Scena di partenza', (d) => void (d.startSceneId = v ? scene.id : null))}
        />
        <Toggle
          checked={!!ending}
          label="Scena finale"
          sub="Etichetta e colore del finale"
          onChange={(v) =>
            apply('Scena finale', (d) => {
              if (v) d.endings.push(makeEnding(scene.id, d.endings.length))
              else d.endings = d.endings.filter((e) => e.sceneId !== scene.id)
            })
          }
        />
        {ending && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <TextInput value={ending.label} placeholder="Es. Finale buono" onCommit={(label) => apply('Etichetta finale', (d) => void (d.endings.find((e) => e.id === ending.id)!.label = label))} />
            <div className="flex gap-1.5">
              {ENDING_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => apply('Colore finale', (d) => void (d.endings.find((e) => e.id === ending.id)!.color = c))}
                  className={cn('size-6 rounded-md', ending.color === c && 'shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--tx)]')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <Field label="Validazione">
        <div className="flex flex-col gap-1.5">
          {issues.length === 0 && (
            <span className="flex items-center gap-1.5 text-[12px] text-safe">
              <CircleCheck size={13} />
              Nessun problema in questa scena
            </span>
          )}
          {issues.map((i) => (
            <span key={i.id} className={cn('flex gap-1.5 text-[12px]', i.severity === 'error' ? 'text-err' : i.severity === 'warning' ? 'text-warn' : 'text-tx3')}>
              {i.severity === 'error' ? <OctagonX size={13} className="mt-0.5 flex-none" /> : <CircleAlert size={13} className="mt-0.5 flex-none" />}
              <span>
                <b className="font-semibold">{i.title}.</b> <span className="text-tx2">{i.detail}</span>
              </span>
            </span>
          ))}
        </div>
      </Field>
      {picking && <ImagePicker value={scene.imageId} onPick={(imageId) => updateScene(scene.id, 'Immagine scena', (s) => void (s.imageId = imageId))} onClose={() => setPicking(false)} />}
    </div>
  )
}

function NpcSection({ scene, n }: { scene: Scene; n: number }) {
  const p = useProject()
  return (
    <Section
      n={n}
      label="NPC presenti"
      right={
        <Combobox
          className="h-6 w-[150px] max-w-full text-[11.5px]"
          value={null}
          placeholder="+ Aggiungi"
          options={options(p, 'npc', (id) => !scene.npcs.some((x) => x.npcId === id))}
          onCreate={(name) => createEntity('npc', name)}
          onChange={(npcId) => npcId && updateScene(scene.id, 'Aggiungi NPC', (s) => void s.npcs.push({ npcId, gate: emptyGate(), dialogs: [] }))}
        />
      }
    >
      {scene.npcs.length === 0 && <Empty>Nessun NPC. Trascina un NPC dal catalogo o usa “Aggiungi”.</Empty>}
      {scene.npcs.map((pres, i) => {
        const dialogs = p.dialogs.filter((d) => d.npcId === pres.npcId)
        return (
          <Row key={pres.npcId} className="flex-col flex-nowrap items-stretch gap-1.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <EntityChip type="npc" id={pres.npcId} />
              <GateButton compact gate={pres.gate} title="Presenza dell’NPC" onChange={(g) => updateScene(scene.id, 'Condizione NPC', (s) => void (s.npcs[i]!.gate = g))} />
              <span className="min-w-0 flex-1 basis-1" />
              <IconButton icon={Trash2} size={13} title="Rimuovi dalla scena" onClick={() => updateScene(scene.id, 'Rimuovi NPC', (s) => void s.npcs.splice(i, 1))} />
            </div>
            {pres.dialogs.map((opt, j) => (
              <div key={j} className="flex flex-wrap items-center gap-2 pl-2">
                <span className="w-[54px] text-[11.5px] text-tx3">{j === 0 ? 'dialogo' : 'oppure'}</span>
                <Combobox
                  className="min-w-[8rem] flex-1"
                  value={opt.dialogId}
                  options={options(p, 'dialog', (id) => dialogs.some((d) => d.id === id))}
                  onChange={(id) => id && updateScene(scene.id, 'Dialogo NPC', (s) => void (s.npcs[i]!.dialogs[j]!.dialogId = id))}
                />
                {isContextOnly(p, opt.dialogId) && <span className="rounded-[3px] border border-dashed border-line2 px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-[.06em] text-tx3">CONTESTO</span>}
                <GateButton compact gate={opt.gate} title="Quando usare questo dialogo" onChange={(g) => updateScene(scene.id, 'Condizione dialogo', (s) => void (s.npcs[i]!.dialogs[j]!.gate = g))} />
                <IconButton icon={Trash2} size={12} onClick={() => updateScene(scene.id, 'Rimuovi dialogo', (s) => void s.npcs[i]!.dialogs.splice(j, 1))} />
              </div>
            ))}
            <div className="pl-2">
              <AddButton
                onClick={() => {
                  let dialogId = dialogs[0]?.id
                  if (!dialogId) {
                    dialogId = newId('dialog')
                    const id = dialogId
                    apply('Nuovo dialogo', (d) =>
                      void d.dialogs.push({ id, npcId: pres.npcId, title: 'Nuovo dialogo', startLineId: null, lines: [] })
                    )
                  }
                  updateScene(scene.id, 'Assegna dialogo', (s) => void s.npcs[i]!.dialogs.push({ dialogId: dialogId!, gate: emptyGate() }))
                }}
              >
                Dialogo{pres.dialogs.length ? ' alternativo' : ''}
              </AddButton>
            </div>
          </Row>
        )
      })}
    </Section>
  )
}

function ItemsSection({ scene, n }: { scene: Scene; n: number }) {
  const p = useProject()
  return (
    <Section
      n={n}
      label="Oggetti presenti"
      right={
        <Combobox
          className="h-6 w-[150px] max-w-full text-[11.5px]"
          value={null}
          placeholder="+ Aggiungi"
          options={options(p, 'item')}
          onCreate={(name) => createEntity('item', name)}
          onChange={(itemId) => itemId && updateScene(scene.id, 'Aggiungi oggetto', (s) => void s.items.push({ id: newId('sceneItem'), itemId, quantity: 1, gate: emptyGate(), checks: [] }))}
        />
      }
    >
      {scene.items.length === 0 && <Empty>Nessun oggetto: casse, ritrovamenti, ricompense della scena.</Empty>}
      {scene.items.map((it, i) => (
        <Row key={it.id}>
          <EntityChip type="item" id={it.itemId} />
          <span className="text-tx3">×</span>
          <NumberInput className="h-7 w-14" min={1} value={it.quantity} onCommit={(q) => updateScene(scene.id, 'Quantità', (s) => void (s.items[i]!.quantity = q ?? 1))} />
          <GateButton gate={it.gate} title="Quando l’oggetto si ottiene" onChange={(g) => updateScene(scene.id, 'Condizione oggetto', (s) => void (s.items[i]!.gate = g))} />
          <span className="min-w-0 flex-1 basis-1" />
          <ChecksButton checks={it.checks} title="Prove per ottenere l’oggetto" targetType={null} onChange={(c) => updateScene(scene.id, 'Prove oggetto', (s) => void (s.items[i]!.checks = c))} />
          <IconButton icon={Trash2} size={13} onClick={() => updateScene(scene.id, 'Rimuovi oggetto', (s) => void s.items.splice(i, 1))} />
        </Row>
      ))}
    </Section>
  )
}

function EncountersSection({ scene, n }: { scene: Scene; n: number }) {
  const p = useProject()
  const [open, setOpen] = useState<string | null>(null)
  if (scene.tag !== 'warning')
    return (
      <Section n={n} label="Incontri">
        <Empty>Gli incontri si aggiungono alle scene Warning.</Empty>
      </Section>
    )
  return (
    <Section
      n={n}
      label="Incontri"
      right={
        <Combobox
          className="h-6 w-[160px] max-w-full text-[11.5px]"
          value={null}
          placeholder="+ Incontro"
          options={options(p, 'encounter', (id) => !scene.encounterIds.includes(id))}
          onCreate={(name) => {
            const id = createEntity('encounter', name || 'Nuovo incontro')
            if (id) setOpen(id)
            return id
          }}
          createLabel=""
          onChange={(id) => id && updateScene(scene.id, 'Aggiungi incontro', (s) => void s.encounterIds.push(id))}
        />
      }
    >
      {scene.encounterIds.length === 0 && <Empty>Scena Warning senza incontro: aggiungine uno.</Empty>}
      {scene.encounterIds.map((id) => {
        const enc = p.encounters.find((e) => e.id === id)
        if (!enc) return <Row key={id} tone="warn">Incontro eliminato</Row>
        const xp = enc.rewards.xp
        return (
          <div key={id} className="flex flex-col gap-1.5">
            <Row tone="warn" className="cursor-pointer" >
              <button type="button" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left" onClick={() => setOpen(open === id ? null : id)}>
                {open === id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Swords size={13} className="text-warn" />
                <span className="font-semibold">{enc.name}</span>
                <span className="flex flex-wrap gap-1">
                  {enc.enemies.map((e, i) => (
                    <EntityChip key={i} type="enemy" id={e.enemyId} label={`${e.quantity} × ${p.enemies.find((x) => x.id === e.enemyId)?.name ?? '?'}`} />
                  ))}
                </span>
              </button>
              <span className="rounded-[3px] border border-warn/50 px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-[.06em] text-warn">
                {enc.nature === 'repeatable' ? 'RIPETIBILE' : 'UNICO'}
              </span>
              {xp > 0 && <span className="font-mono text-[10.5px] text-tx2">{xp} PE</span>}
              <IconButton icon={Trash2} size={13} title="Togli dalla scena" onClick={() => void detachEncounter(scene.id, id)} />
            </Row>
            {open === id && <EncounterEditor encounter={enc} />}
          </div>
        )
      })}
    </Section>
  )
}

function LinksSection({ scene, n }: { scene: Scene; n: number }) {
  const p = useProject()
  const pathEnding = useUiStore((s) => s.pathEndingId) ?? p.endings[0]?.id ?? null
  const path = useMemo(() => (pathEnding ? decisivePath(p, pathEnding) : null), [p, pathEnding])
  const ending = p.endings.find((e) => e.id === pathEnding)
  const exits = p.links.filter((l) => l.fromSceneId === scene.id || (l.bidirectional && l.toSceneId === scene.id))
  const updateLink = (id: string, label: string, recipe: (l: (typeof p.links)[number]) => void, mergeKey?: string) =>
    apply(label, (d) => recipe(d.links.find((l) => l.id === id)!), mergeKey)

  return (
    <Section
      n={n}
      label="Collegamenti in uscita"
      right={
        <Combobox
          className="h-6 w-[150px] max-w-full text-[11.5px]"
          value={null}
          placeholder="+ Collega"
          options={options(p, 'scene', (id) => id !== scene.id && canLink(p, scene.id, id))}
          onChange={(to) =>
            to &&
            apply('Nuovo collegamento', (d) => {
              if (canLink(d, scene.id, to)) d.links.push(makeLink(scene.id, to))
            })
          }
        />
      }
    >
      {exits.length === 0 && <Empty>Nessuna uscita.</Empty>}
      {exits.map((l) => {
        const reverse = l.fromSceneId !== scene.id
        const decisive = path?.linkIds.has(l.id) || ending?.manualDecisive.some((m) => m.id === l.id)
        const manual = ending?.manualDecisive.some((m) => m.id === l.id)
        return (
          <Row key={l.id}>
            {l.bidirectional ? <ArrowLeftRight size={13} className="text-tx3" /> : <ArrowRight size={13} className="text-tx3" />}
            <TextInput
              className="h-7 min-w-[6rem] flex-1 basis-28"
              placeholder="Etichetta"
              value={l.label}
              onCommit={(label) => updateLink(l.id, 'Etichetta collegamento', (x) => void (x.label = label))}
            />
            <Combobox
              className="h-7 min-w-[7rem] flex-1 basis-32"
              value={reverse ? l.fromSceneId : l.toSceneId}
              options={options(p, 'scene', (id) => id !== scene.id && (id === (reverse ? l.fromSceneId : l.toSceneId) || (reverse ? canLink(p, id, scene.id, l.bidirectional, l.id) : canLink(p, scene.id, id, l.bidirectional, l.id))))}
              onChange={(id) => id && updateLink(l.id, 'Destinazione', (x) => void (reverse ? (x.fromSceneId = id) : (x.toSceneId = id)))}
            />
            <IconButton
              icon={ArrowLeftRight}
              size={13}
              className={cn(l.bidirectional && 'bg-acbg text-ac')}
              title="Bidirezionale"
              disabled={!l.bidirectional && !canLink(p, l.fromSceneId, l.toSceneId, true, l.id)}
              onClick={() => updateLink(l.id, 'Direzione', (x) => void (x.bidirectional = !x.bidirectional))}
            />
            <GateButton
              compact
              gate={l.gate}
              title={`Collegamento «${l.label || 'senza etichetta'}»`}
              effects={l.effects}
              onChange={(g) => updateLink(l.id, 'Condizione collegamento', (x) => void (x.gate = g))}
              onEffects={(fx) => updateLink(l.id, 'Effetti collegamento', (x) => void (x.effects = fx))}
            />
            <ChecksButton checks={l.checks} title="Prove sul collegamento" targetType="scene" onChange={(c) => updateLink(l.id, 'Prove collegamento', (x) => void (x.checks = c))} />
            {ending && (
              <button
                type="button"
                title={`Segna come scelta decisiva per «${ending.label}»`}
                onClick={() =>
                  apply('Scelta decisiva', (d) => {
                    const e = d.endings.find((x) => x.id === ending.id)!
                    e.manualDecisive = manual ? e.manualDecisive.filter((m) => m.id !== l.id) : [...e.manualDecisive, { type: 'link', id: l.id }]
                  })
                }
                className={cn('flex items-center gap-1 rounded-[3px] px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-[.06em]', decisive ? '' : 'text-tx3 hover:bg-hover')}
                style={decisive ? { color: ending.color, background: `color-mix(in srgb, ${ending.color} 14%, transparent)` } : undefined}
              >
                <Flag size={10} />
                {decisive ? 'DECISIVO' : 'decisivo?'}
              </button>
            )}
            <IconButton icon={Trash2} size={13} onClick={() => apply('Elimina collegamento', (d) => void (d.links = d.links.filter((x) => x.id !== l.id)))} />
          </Row>
        )
      })}
    </Section>
  )
}

function EntrySection({ scene, n }: { scene: Scene; n: number }) {
  const p = useProject()
  return (
    <Section n={n} label="Effetti all’ingresso">
      <EffectList effects={scene.entryEffects} onChange={(fx) => updateScene(scene.id, 'Effetti ingresso', (s) => void (s.entryEffects = fx))} />
      <Toggle
        checked={!!scene.entryCheck}
        label="Prova di abilità all’ingresso"
        sub="Riuscita e fallimento possono portare a scene diverse"
        onChange={(v) => updateScene(scene.id, 'Prova ingresso', (s) => void (s.entryCheck = v ? newCheck(p.settings.skills[0]?.id ?? '') : null))}
      />
      {scene.entryCheck && <SkillCheckEditor check={scene.entryCheck} targetType="scene" onChange={(c) => updateScene(scene.id, 'Prova ingresso', (s) => void (s.entryCheck = c))} />}
    </Section>
  )
}

function SceneBody({ scene, docked, deleteButton }: { scene: Scene; docked: boolean; deleteButton: ReactNode }) {
  let n = 0
  const sections: ReactNode = (
    <>
      <Section n={++n} label="Descrizione">
        <TextArea rows={docked ? 5 : 4} value={scene.description} onCommit={(description) => updateScene(scene.id, 'Descrizione scena', (s) => void (s.description = description))} />
      </Section>
      <NpcSection scene={scene} n={++n} />
      <ItemsSection scene={scene} n={++n} />
      <EncountersSection scene={scene} n={++n} />
      <LinksSection scene={scene} n={++n} />
      <EntrySection scene={scene} n={++n} />
      <Section n={++n} label="Condizione di accesso">
        <GateButton gate={scene.access} title={`Accesso a «${scene.title}»`} prefix="Accessibile se" onChange={(g) => updateScene(scene.id, 'Accesso scena', (s) => void (s.access = g))} />
      </Section>
    </>
  )
  if (docked)
    return (
      <div className="flex flex-col px-4 pt-3">
        <SidePanel scene={scene} />
        <div className="mt-3 border-t border-line">{sections}</div>
        <div className="flex justify-center border-t border-line py-5">{deleteButton}</div>
      </div>
    )
  return (
    <div className="grid min-h-full grid-cols-[340px_1fr]">
      <div className="border-r border-line p-5">
        <SidePanel scene={scene} />
      </div>
      <div className="flex min-w-0 flex-col px-5">
        {sections}
        <div className="flex justify-end border-t border-line py-5">{deleteButton}</div>
      </div>
    </div>
  )
}

/** Chip del tag nell'intestazione: un clic lo nasconde o lo mostra sul nodo (nascosto = barre diagonali). */
function TagToggle({ scene }: { scene: Scene }) {
  return (
    <button
      type="button"
      title={scene.tagHidden ? 'Tag nascosto nel grafo: clic per mostrarlo' : 'Clic per nascondere il tag nel grafo'}
      className="cursor-pointer rounded-[4px] hover:opacity-80"
      onClick={() => updateScene(scene.id, scene.tagHidden ? 'Mostra tag' : 'Nascondi tag', (s) => void (s.tagHidden = !s.tagHidden))}
    >
      <TagChip tag={scene.tag} hidden={scene.tagHidden} />
    </button>
  )
}

function Title({ scene }: { scene: Scene }) {
  return (
    <TextInput
      className="h-auto w-full border-transparent bg-transparent px-0 text-[22px] font-semibold tracking-[-.01em] focus:border-transparent focus:shadow-none"
      value={scene.title}
      onCommit={(title) => title.trim() && updateScene(scene.id, 'Titolo scena', (s) => void (s.title = title.trim()))}
    />
  )
}

/** `modal`: la scheda è nella finestra al centro (si può agganciare al dock); altrimenti è nel dock (si può aprire al centro). */
function useSceneActions(scene: Scene, modal: boolean) {
  const ui = useUiStore()
  const kbdHere = useKbd('playFromHere')
  const remove = async () => {
    const owners = await deleteScene(scene.id)
    if (owners) ui.showBlocked({ name: scene.title, owners })
  }
  const actions = (
    <>
      <IconButton icon={Play} size={14} title={kbdHere ? `Parti da qui (${kbdHere})` : 'Parti da qui'} onClick={() => playFromScene(scene.id)} />
      {modal ? (
        <IconButton
          icon={PanelLeft}
          size={14}
          title="Aggancia al dock"
          onClick={() => {
            ui.openSheet(null)
            dockBridge.openPanel?.('inspector')
          }}
        />
      ) : (
        <IconButton icon={PanelTop} size={14} title="Apri in una finestra al centro" onClick={() => ui.openSheet({ kind: 'scene', id: scene.id })} />
      )}
    </>
  )
  const deleteButton = (
    <DangerButton onClick={remove} title="Elimina la scena e i suoi collegamenti">
      Elimina scena
    </DangerButton>
  )
  return { actions, dialog: null, deleteButton }
}

/** Scheda scena in finestra centrale (2a). */
export function SceneSheet({ id }: { id: string }) {
  const p = useProject()
  const scene = p.scenes.find((s) => s.id === id)
  const close = () => useUiStore.getState().openSheet(null)
  if (!scene) return null
  return <SceneWindow scene={scene} onClose={close} groupPath={groupPath(p, scene.groupId)} />
}

function SceneWindow({ scene, onClose, groupPath }: { scene: Scene; onClose(): void; groupPath: string }) {
  const { actions, dialog, deleteButton } = useSceneActions(scene, true)
  return (
    <Sheet
      category="Scena"
      chips={
        <>
          <TagToggle scene={scene} />
          {groupPath && <span className="text-[11.5px] text-tx3">{groupPath}</span>}
        </>
      }
      title={<Title scene={scene} />}
      actions={actions}
      width={1120}
      height={944}
      onClose={onClose}
      footer={<EditHint />}
    >
      <SceneBody scene={scene} docked={false} deleteButton={deleteButton} />
      {dialog}
    </Sheet>
  )
}

export function groupPath(p: ReturnType<typeof useProject>, groupId: string | null): string {
  const names: string[] = []
  let g = p.groups.find((x) => x.id === groupId)
  while (g) {
    names.unshift(g.name)
    g = p.groups.find((x) => x.id === g!.parentId)
  }
  return names.join(' › ')
}

/** Scheda della scena selezionata, nel dock. */
export function DockedScenePanel() {
  const p = useProject()
  const selected = useUiStore((s) => s.selectedSceneIds)
  const scene = p.scenes.find((s) => s.id === selected[0])
  if (!scene)
    return (
      <div className="flex h-full min-h-0 flex-col bg-panel">
        <SheetHeader category="Scena" title="Nessuna selezione" />
        <div className="p-5 text-tx3">Seleziona una scena nel grafo per vederne la scheda.</div>
      </div>
    )
  return <DockedInner scene={scene} />
}

function DockedInner({ scene }: { scene: Scene }) {
  const p = useProject()
  const { actions, dialog, deleteButton } = useSceneActions(scene, false)
  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <SheetHeader
        category="Scena"
        chips={
          <>
            <TagToggle scene={scene} />
            <span className="text-[11.5px] text-tx3">{groupPath(p, scene.groupId)}</span>
          </>
        }
        title={<Title scene={scene} />}
        actions={actions}
      />
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <SceneBody scene={scene} docked deleteButton={deleteButton} />
      </div>
      {dialog}
    </div>
  )
}
