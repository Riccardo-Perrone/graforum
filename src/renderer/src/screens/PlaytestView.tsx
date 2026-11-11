import { useMemo, useState } from 'react'
import { ArrowRight, LocateFixed, Dices, Flag, Lock, MessageSquare, Minus, Package, Plus, RotateCcw, Save, ShoppingBag, Swords, Undo2, UserRound } from 'lucide-react'
import { imageUrl } from '@shared/ipc'
import { newId, type Dialog, type DialogChoice, type Effect, type QuestState, type SkillCheck } from '@shared/model'
import {
  applyEffects,
  decisivePath,
  describeCheck,
  describeCondition,
  evalCondition,
  gateStatus,
  initialPlayState,
  leaves,
  manualKey,
  updateState,
  type PlayState
} from '@shared/engine'
import { Combobox } from '../components/ui/Combobox'
import { Button, Select, TextInput, Toggle } from '../components/ui/form'
import { IconButton, Kbd, TAG_META, TagChip, ToolbarButton, cn } from '../components/ui/primitives'
import { groupPath } from '../components/scene/SceneSheet'
import { apply, options, useProject } from '../lib/entities'
import { useKbd } from '../lib/commands'
import { useUiStore } from '../store/ui'

// Playtest (7a): percorre la storia come un giocatore. Reale (gli oggetti raccolti si possiedono
// davvero) e debug (si parte da qualsiasi scena e si assegnano oggetti e stati a mano).

const QUEST_STATES: [QuestState, string][] = [
  ['notStarted', 'non iniziata'],
  ['inProgress', 'in corso'],
  ['completed', 'completata']
]

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">{children}</span>
}

/** Esito manuale di una prova: nessun dado, decide chi prova la storia. */
function CheckButtons({ check, onResult }: { check: SkillCheck; onResult(ok: boolean): void }) {
  const p = useProject()
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 font-mono text-[10.5px] text-tx2">
        <Dices size={12} />
        {describeCheck(p, check)}
      </span>
      <Button className="h-7 border-safe/50 px-2 text-safe" onClick={() => onResult(true)}>
        Riuscita
      </Button>
      <Button className="h-7 border-err/50 px-2 text-err" onClick={() => onResult(false)}>
        Fallimento
      </Button>
    </span>
  )
}

export function PlaytestView({ startSceneId }: { startSceneId: string | null }) {
  const p = useProject()
  const ui = useUiStore()
  const [presetId, setPresetId] = useState('')
  const begin = (pid: string, sceneId = startSceneId ?? p.startSceneId) => {
    let s = initialPlayState(p, p.presets.find((x) => x.id === pid))
    s = { ...s, sceneId: null }
    return sceneId ? enter(s, sceneId, 'partenza') : s
  }

  /** Ingresso in una scena: visitata, effetti all'ingresso, cronologia. */
  function enter(s: PlayState, sceneId: string, note: string): PlayState {
    const scene = p.scenes.find((x) => x.id === sceneId)
    if (!scene) return s
    let next = updateState(p, s, (x) => {
      x.sceneId = sceneId
      if (!x.visited.includes(sceneId)) x.visited.push(sceneId)
      x.history.push({ sceneId, note })
    })
    next = applyEffects(p, next, scene.entryEffects)
    return next
  }

  const [state, setState] = useState<PlayState>(() => begin(''))
  const [past, setPast] = useState<PlayState[]>([])
  const [log, setLog] = useState<string[]>([])
  const [talk, setTalk] = useState<{ dialogId: string; lineId: string | null } | null>(null)
  const [pendingCheck, setPendingCheck] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('')
  const [entryDone, setEntryDone] = useState<string[]>([])

  const commit = (next: PlayState, note?: string) => {
    setPast((h) => [...h.slice(-50), state])
    setState(next)
    if (note) setLog((l) => [...l, note])
  }
  const restart = (pid = presetId) => {
    setState(begin(pid))
    setPast([])
    setLog([])
    setTalk(null)
    setEntryDone([])
  }
  const back = () => {
    const prev = past.at(-1)
    if (!prev) return
    setPast(past.slice(0, -1))
    setState(prev)
    setTalk(null)
  }
  const kbdHere = useKbd('playFromHere')

  const scene = p.scenes.find((s) => s.id === state.sceneId)
  const pathEnding = ui.pathEndingId ?? p.endings[0]?.id ?? null
  const path = useMemo(() => (pathEnding ? decisivePath(p, pathEnding) : null), [p, pathEnding])
  const ending = p.endings.find((e) => e.id === pathEnding)
  const reachedEnding = p.endings.find((e) => e.sceneId === state.sceneId)
  const go = (sceneId: string, note: string, fx: Effect[] = []) => {
    commit(enter(applyEffects(p, state, fx), sceneId, note), `→ ${p.scenes.find((s) => s.id === sceneId)?.title} (${note})`)
    setTalk(null)
    setPendingCheck(null)
  }

  const exits = scene
    ? p.links
        .filter((l) => l.fromSceneId === scene.id || (l.bidirectional && l.toSceneId === scene.id))
        .map((l) => ({ link: l, to: l.fromSceneId === scene.id ? l.toSceneId : l.fromSceneId, status: gateStatus(p, state, l.gate, l.id) }))
    : []
  const encounters = scene ? scene.encounterIds.map((id) => p.encounters.find((e) => e.id === id)!).filter(Boolean) : []
  const customLeaves = useMemo(() => {
    const found = new Map<string, string>()
    const visit = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>
        if (o['type'] === 'customType' || (o['type'] === 'freeText' && 'ref' in o)) {
          for (const leaf of leaves(o as never)) found.set(manualKey(leaf), describeCondition(p, leaf))
        }
        Object.values(o).forEach(visit)
      }
    }
    visit(p)
    return [...found.entries()]
  }, [p])

  /** Dialogo dentro il playtest: usa lo stesso stato della partita. */
  const DialogPanel = ({ dialog }: { dialog: Dialog }) => {
    const npc = p.npcs.find((n) => n.id === dialog.npcId)
    const line = dialog.lines.find((l) => l.id === talk?.lineId)
    const choose = (c: DialogChoice, outcome?: boolean) => {
      let s = updateState(p, state, (x) => {
        x.choices.push(c.id)
        if (npc && !x.talkedTo.includes(npc.id)) x.talkedTo.push(npc.id)
        if (outcome && c.check) x.passedChecks.push(c.check.id)
      })
      const res = c.check && outcome !== undefined ? c.check[outcome ? 'success' : 'failure'] : null
      s = applyEffects(p, s, [...c.effects, ...(res?.effects ?? [])])
      const target = res ? (res.target?.id ?? (outcome ? c.targetLineId : null)) : c.targetLineId
      const next = dialog.lines.find((l) => l.id === target)
      if (next) s = applyEffects(p, s, next.effects)
      else s = updateState(p, s, (x) => void (!x.completedDialogs.includes(dialog.id) && x.completedDialogs.push(dialog.id)))
      commit(s, `${npc?.name}: «${c.text}»${c.check ? (outcome ? ' (riuscita)' : ' (fallimento)') : ''}`)
      setTalk(next ? { dialogId: dialog.id, lineId: next.id } : null)
      setPendingCheck(null)
    }
    if (!line) return null
    const speaker = line.speaker.kind === 'npc' ? npc?.name : line.speaker.kind === 'player' ? 'Giocatore' : line.speaker.name
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-acln bg-acbg/40 p-4">
        <Label>{speaker?.toUpperCase()}</Label>
        <p className="m-0 text-[15px] leading-[1.6]">«{line.text}»</p>
        {line.choices.length === 0 && (
          <Button className="self-start" onClick={() => (commit(updateState(p, state, (x) => void (!x.completedDialogs.includes(dialog.id) && x.completedDialogs.push(dialog.id))), `Fine dialogo ${dialog.title}`), setTalk(null))}>
            Fine del dialogo
          </Button>
        )}
        {line.choices.map((c) => {
          const st = gateStatus(p, state, c.gate, c.id)
          if (st === 'hidden') return null
          return (
            <div key={c.id} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={st === 'locked'}
                onClick={() => (c.check ? setPendingCheck(c.id) : choose(c))}
                className={cn('flex items-center gap-2 rounded-2xl border px-3 py-2 text-left', st === 'locked' ? 'border-dashed border-line2 text-tx3' : 'border-acln bg-acbg hover:brightness-125')}
              >
                {st === 'locked' ? <Lock size={12} /> : <MessageSquare size={12} className="text-ac" />}
                <span className="flex-1">{c.text}</span>
                {c.check && <Dices size={12} />}
              </button>
              {st === 'locked' && c.gate.lockedMessage && <span className="pl-3 text-[12px] text-tx3">{c.gate.lockedMessage}</span>}
              {pendingCheck === c.id && c.check && (
                <div className="pl-3">
                  <CheckButtons check={c.check} onResult={(ok) => choose(c, ok)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const currency = p.settings.currencyItemId
  const talkingDialog = talk ? p.dialogs.find((d) => d.id === talk.dialogId) : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-panel px-3 py-1">
        <span className="rounded-[4px] bg-ac px-2 py-0.5 font-mono text-[10px] font-bold tracking-[.08em] text-btntx">PLAYTEST</span>
        <span className="text-[12px] text-tx3">Solo verifica: nessun dado, scegli tu gli esiti.</span>
        <span className="mx-1 h-5 w-px bg-line2" />
        <span className="text-[12px] text-tx3">Preset</span>
        <Select
          className="h-7 w-[220px]"
          value={presetId}
          options={[['', 'Inventario vuoto'] as const, ...p.presets.map((x) => [x.id, x.name] as const)]}
          onChange={(v) => (setPresetId(v), restart(v))}
        />
        <TextInput className="h-7 w-[170px]" placeholder="Nome nuovo preset" value={presetName} onCommit={setPresetName} />
        <ToolbarButton
          icon={Save}
          variant="outline"
          disabled={!presetName.trim()}
          onClick={() => {
            const id = newId('preset')
            apply('Salva preset', (d) =>
              void d.presets.push({
                id,
                name: presetName.trim(),
                items: Object.entries(state.inventory).map(([itemId, quantity]) => ({ itemId, quantity })),
                quests: [
                  ...Object.entries(state.questStates).map(([questId, st]) => ({ questId, stepId: null, state: st })),
                  ...Object.entries(state.stepStates).map(([stepId, st]) => ({ questId: p.quests.find((q) => q.steps.some((x) => x.id === stepId))?.id ?? '', stepId, state: st }))
                ],
                flags: Object.entries(state.flags).map(([flagId, value]) => ({ flagId, value }))
              })
            )
            setPresetId(id)
            setPresetName('')
          }}
        >
          Salva stato come preset
        </ToolbarButton>
        <span className="flex-1" />
        <ToolbarButton icon={Undo2} variant="ghost" disabled={past.length === 0} onClick={back}>
          Indietro
        </ToolbarButton>
        <ToolbarButton icon={RotateCcw} variant="ghost" onClick={() => restart()}>
          Ricomincia
        </ToolbarButton>
        <ToolbarButton
          icon={LocateFixed}
          variant="default"
          onClick={() => {
            ui.setView({ kind: 'graph' })
            if (state.sceneId) setTimeout(() => ui.focusScene(state.sceneId!), 100)
          }}
        >
          Mostra nel grafo{scene ? ` · ${scene.title}` : ''}
        </ToolbarButton>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[300px] flex-none flex-col gap-2 overflow-y-auto border-r border-line bg-panel p-3" data-text-scale>
          <Label>PERCORSO · {state.history.length} SCENE</Label>
          {state.history.map((h, i) => {
            const s = p.scenes.find((x) => x.id === h.sceneId)
            const current = i === state.history.length - 1
            return (
              <div key={i} className="flex gap-2">
                <span className={cn('mt-1.5 size-2 flex-none rounded-full', current ? 'bg-ac' : 'bg-line2')} />
                <div className="min-w-0">
                  <div className={cn('truncate font-medium', current && 'text-ac')}>{s?.title}</div>
                  <div className="truncate text-[11.5px] text-tx3">{current ? 'scena corrente' : h.note}</div>
                </div>
              </div>
            )
          })}
          <div className="mt-2 flex flex-col gap-1">
            <Label>REGISTRO</Label>
            {log.slice(-30).map((l, i) => (
              <span key={i} className="font-mono text-[10.5px] text-tx2">
                {l}
              </span>
            ))}
          </div>
          <div className="mt-auto rounded-lg border border-line p-3 text-[12px] text-tx3">
            <b className="text-tx2">Partire da un’altra scena?</b> Nel grafo: clic destro su una scena › <i>Parti da qui</i>, oppure selezionala{kbdHere && <> e premi <Kbd>{kbdHere}</Kbd></>}.
            <Combobox className="mt-2" value={null} placeholder="Salta a una scena (debug)" options={options(p, 'scene')} onChange={(id) => id && go(id, 'salto di debug')} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 justify-center overflow-y-auto" data-text-scale>
          {!scene ? (
            <div className="grid place-items-center text-tx3">Nessuna scena di partenza. Impostala in una scheda scena.</div>
          ) : (
            <div className="flex w-full max-w-[760px] flex-col gap-4 px-8 py-6">
              <div className="stripes relative aspect-[21/9] overflow-hidden rounded-xl border border-line2">
                {scene.imageId && <img src={imageUrl(scene.imageId)} alt="" className="absolute inset-0 size-full object-cover" />}
              </div>
              <div className="flex items-center gap-2">
                <TagChip tag={scene.tag} />
                <span className="text-[12px] text-tx3">{groupPath(p, scene.groupId)}</span>
              </div>
              <h1 className="m-0 text-[28px] font-semibold tracking-[-.02em]">{scene.title}</h1>
              <p className="m-0 text-[15px] leading-[1.65] text-tx2">{scene.description}</p>
              {reachedEnding && (
                <div className="flex items-center gap-2 rounded-xl border-2 p-4 text-[15px] font-semibold" style={{ borderColor: reachedEnding.color, color: reachedEnding.color }}>
                  <Flag size={16} />
                  Finale raggiunto: {reachedEnding.label}
                </div>
              )}

              {scene.entryCheck && !entryDone.includes(`${scene.id}-${state.history.length}`) && (
                <div className="flex items-center gap-3 rounded-xl border border-line2 p-3">
                  <span className="flex-1 text-[13px]">Prova all’ingresso</span>
                  <CheckButtons
                    check={scene.entryCheck}
                    onResult={(ok) => {
                      const res = scene.entryCheck![ok ? 'success' : 'failure']
                      setEntryDone((d) => [...d, `${scene.id}-${state.history.length + (res.target ? 1 : 0)}`])
                      const s = updateState(p, state, (x) => void (ok && x.passedChecks.push(scene.entryCheck!.id)))
                      if (res.target?.type === 'scene') commit(enter(applyEffects(p, s, res.effects), res.target.id, ok ? 'prova riuscita' : 'prova fallita'))
                      else commit(applyEffects(p, s, res.effects), `Prova all’ingresso: ${ok ? 'riuscita' : 'fallita'}`)
                    }}
                  />
                </div>
              )}

              {encounters.map((e) => {
                const done = state.encounters[e.id]
                const finished = done && e.nature === 'unique'
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-warn/60 bg-warnbg p-3">
                    <Swords size={15} className="text-warn" />
                    <span className="font-semibold">Incontro: {e.enemies.map((x) => `${x.quantity} × ${p.enemies.find((y) => y.id === x.enemyId)?.name}`).join(', ')}</span>
                    <span className="text-[12px] text-tx3">{e.nature === 'repeatable' ? 'ripetibile' : 'unico'}</span>
                    <span className="flex-1" />
                    {finished ? (
                      <span className="font-mono text-[11px] text-tx3">concluso: {done === 'win' ? 'vinto' : done === 'flee' ? 'fuga' : 'sconfitta'}</span>
                    ) : (
                      (['win', 'flee', 'defeat'] as const).map((o) => (
                        <Button
                          key={o}
                          className={cn('h-7', o === 'win' ? 'text-safe' : o === 'defeat' ? 'text-err' : 'text-warn')}
                          onClick={() => {
                            const out = e.outcomes[o]
                            let s = updateState(p, state, (x) => void (x.encounters[e.id] = o))
                            const rewards: Effect[] = o === 'win' ? e.rewards.items.map((r) => ({ type: 'gainItem', itemId: r.itemId, quantity: r.quantity })) : []
                            s = applyEffects(p, s, [...out.effects, ...rewards])
                            if (out.target?.type === 'scene') commit(enter(s, out.target.id, `incontro: ${o === 'win' ? 'vinto' : o === 'flee' ? 'fuga' : 'sconfitta'}`))
                            else commit(s, `Incontro ${e.name}: ${o === 'win' ? 'vinto' : o === 'flee' ? 'fuga' : 'sconfitta'}`)
                          }}
                        >
                          {o === 'win' ? 'Vinto' : o === 'flee' ? 'Fuga' : 'Sconfitta'}
                        </Button>
                      ))
                    )}
                  </div>
                )
              })}

              {scene.npcs.map((pres) => {
                const npc = p.npcs.find((n) => n.id === pres.npcId)
                const st = gateStatus(p, state, pres.gate, pres.npcId)
                if (!npc || st === 'hidden') return null
                const dialog = pres.dialogs.find((d) => evalCondition(p, state, d.gate.condition))
                const dlg = dialog ? p.dialogs.find((x) => x.id === dialog.dialogId) : undefined
                const cur = currency ? (state.inventory[currency] ?? 0) : 0
                return (
                  <div key={pres.npcId} className="flex flex-col gap-2 rounded-xl border border-line2 p-3">
                    <div className="flex items-center gap-2">
                      <UserRound size={14} className="text-ac" />
                      <span className="font-semibold">{npc.name}</span>
                      <span className="text-[12px] text-tx3">{npc.role}</span>
                      <span className="flex-1" />
                      {dlg && dlg.startLineId && talk?.dialogId !== dlg.id && (
                        <Button className="h-7" disabled={st === 'locked'} onClick={() => setTalk({ dialogId: dlg.id, lineId: dlg.startLineId })}>
                          <MessageSquare size={12} /> Parla · {dlg.title}
                        </Button>
                      )}
                    </div>
                    {talkingDialog && talkingDialog.npcId === npc.id && <DialogPanel dialog={talkingDialog} />}
                    {npc.services.shop.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <Label>NEGOZIO</Label>
                        {npc.services.shop.map((s, i) => {
                          const gs = gateStatus(p, state, s.gate)
                          if (gs === 'hidden') return null
                          const item = p.items.find((x) => x.id === s.itemId)
                          const ok = gs === 'open' && (!currency || cur >= s.price)
                          return (
                            <div key={i} className="flex items-center gap-2 text-[12.5px]">
                              <ShoppingBag size={12} className="text-tx3" />
                              <span className="flex-1">{item?.name}</span>
                              <span className="font-mono text-[11px] text-tx3">{s.price} {p.items.find((x) => x.id === currency)?.name ?? ''}</span>
                              <Button
                                className="h-6 px-2"
                                disabled={!ok}
                                title={!ok ? 'Denaro insufficiente o merce bloccata' : undefined}
                                onClick={() =>
                                  commit(
                                    applyEffects(p, state, [
                                      ...(currency && s.price ? [{ type: 'loseItem' as const, itemId: currency, quantity: s.price }] : []),
                                      { type: 'gainItem', itemId: s.itemId, quantity: 1 }
                                    ]),
                                    `Acquisto: ${item?.name}`
                                  )
                                }
                              >
                                Compra
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {scene.items.map((it) => {
                const st = gateStatus(p, state, it.gate, it.id)
                const item = p.items.find((x) => x.id === it.itemId)
                const taken = state.choices.includes(`take:${it.id}`)
                if (st === 'hidden' && it.checks.length === 0) return null
                return (
                  <div key={it.id} className={cn('flex flex-wrap items-center gap-2 rounded-xl border p-3', st === 'open' ? 'border-line2' : 'border-dashed border-line2 text-tx3')}>
                    <Package size={14} />
                    <span className="flex-1">
                      {item?.name} {it.quantity > 1 && `× ${it.quantity}`}
                      {st !== 'open' && <span className="block text-[12px]">{it.gate.lockedMessage || describeCondition(p, it.gate.condition)}</span>}
                    </span>
                    {taken ? (
                      <span className="font-mono text-[11px]">raccolto</span>
                    ) : st === 'open' ? (
                      <Button className="h-7" onClick={() => commit(updateState(p, applyEffects(p, state, [{ type: 'gainItem', itemId: it.itemId, quantity: it.quantity }]), (x) => void x.choices.push(`take:${it.id}`)), `Raccolto: ${item?.name}`)}>
                        Raccogli
                      </Button>
                    ) : (
                      it.checks.map((c) => (
                        <CheckButtons
                          key={c.id}
                          check={c}
                          onResult={(ok) => commit(applyEffects(p, updateState(p, state, (x) => void (ok && x.passedChecks.push(c.id))), c[ok ? 'success' : 'failure'].effects), `${describeCheck(p, c)}: ${ok ? 'riuscita' : 'fallita'}`)}
                        />
                      ))
                    )}
                  </div>
                )
              })}

              <div className="flex flex-col gap-2">
                <Label>SCELTE DISPONIBILI</Label>
                {exits.length === 0 && <span className="text-tx3">Nessuna uscita da questa scena.</span>}
                {exits.map(({ link, to, status }) => {
                  if (status === 'hidden') return null
                  const target = p.scenes.find((s) => s.id === to)
                  const targetStatus = target ? gateStatus(p, state, target.access, target.id) : 'open'
                  const locked = status === 'locked' || targetStatus !== 'open'
                  const key = `link-${link.id}`
                  return (
                    <div key={link.id} className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => (link.checks.length ? setPendingCheck(key) : go(to, link.label || 'collegamento', link.effects))}
                        className={cn('flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left', locked ? 'border-dashed border-line2 text-tx3' : 'border-line2 hover:border-ac hover:bg-acbg')}
                      >
                        {locked ? <Lock size={13} /> : <ArrowRight size={13} className="text-ac" />}
                        <span className="flex-1 font-medium">{link.label || 'Prosegui'}</span>
                        <span className="text-[12px] text-tx3">{target?.title}</span>
                        {path?.linkIds.has(link.id) && ending && <Flag size={12} style={{ color: ending.color }} />}
                      </button>
                      {locked && (
                        <span className="pl-4 text-[12px] text-tx3">
                          {(status === 'locked' ? link.gate.lockedMessage || describeCondition(p, link.gate.condition) : target?.access.lockedMessage || describeCondition(p, target?.access.condition ?? null))}
                        </span>
                      )}
                      {pendingCheck === key &&
                        link.checks.map((c) => (
                          <div key={c.id} className="pl-4">
                            <CheckButtons
                              check={c}
                              onResult={(ok) => {
                                const res = c[ok ? 'success' : 'failure']
                                const s = updateState(p, state, (x) => void (ok && x.passedChecks.push(c.id)))
                                const dest = res.target?.type === 'scene' ? res.target.id : ok ? to : null
                                if (dest) commit(enter(applyEffects(p, s, [...link.effects, ...res.effects]), dest, `${describeCheck(p, c)} ${ok ? 'riuscita' : 'fallita'}`))
                                else commit(applyEffects(p, s, res.effects), `${describeCheck(p, c)}: fallita, resti qui`)
                                setPendingCheck(null)
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>

        <aside className="flex w-[400px] flex-none flex-col gap-5 overflow-y-auto border-l border-line bg-panel p-4" data-text-scale>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>INVENTARIO</Label>
              <Combobox
                className="h-6 w-[170px] text-[11.5px]"
                value={null}
                placeholder="+ Aggiungi (debug)"
                options={options(p, 'item')}
                onChange={(id) => id && commit(applyEffects(p, state, [{ type: 'gainItem', itemId: id, quantity: 1 }]), `Debug: +1 ${p.items.find((i) => i.id === id)?.name}`)}
              />
            </div>
            {Object.keys(state.inventory).length === 0 && <span className="text-[12px] text-tx3">Vuoto</span>}
            {Object.entries(state.inventory).map(([id, q]) => (
              <div key={id} className="flex items-center gap-2 rounded-md border border-line2 px-2 py-1">
                <Package size={12} className="text-tx3" />
                <span className="flex-1">{p.items.find((i) => i.id === id)?.name ?? '(eliminato)'}</span>
                <IconButton icon={Minus} size={12} onClick={() => commit(applyEffects(p, state, [{ type: 'loseItem', itemId: id, quantity: 1 }]))} />
                <span className="w-8 text-center font-mono text-[11px]">{q}</span>
                <IconButton icon={Plus} size={12} onClick={() => commit(applyEffects(p, state, [{ type: 'gainItem', itemId: id, quantity: 1 }]))} />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label>QUEST</Label>
            {p.quests.map((q) => {
              const qs = state.questStates[q.id] ?? 'notStarted'
              const done = q.steps.filter((s) => state.stepStates[s.id] === 'completed').length
              return (
                <div key={q.id} className="flex flex-col gap-1.5 rounded-md border border-line2 p-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-medium">{q.title}</span>
                    <Select className="h-6 w-[120px] text-[11.5px]" value={qs} options={QUEST_STATES} onChange={(v) => commit(updateState(p, state, (x) => void (x.questStates[q.id] = v)), `Debug: ${q.title} ${v}`)} />
                  </div>
                  <div className="flex h-1.5 gap-0.5">
                    {q.steps.map((s) => (
                      <span key={s.id} className={cn('flex-1 rounded-full', state.stepStates[s.id] === 'completed' ? 'bg-safe' : state.stepStates[s.id] === 'inProgress' ? 'bg-ac' : 'bg-line2')} />
                    ))}
                  </div>
                  <span className="font-mono text-[10.5px] text-tx3">
                    step {done} / {q.steps.length}
                    {q.steps.find((s) => state.stepStates[s.id] !== 'completed') && ` · ${q.steps.find((s) => state.stepStates[s.id] !== 'completed')!.title}`}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {q.steps.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        title={`Debug: segna lo step ${i + 1} come completato o no`}
                        onClick={() => commit(updateState(p, state, (x) => void (x.stepStates[s.id] = x.stepStates[s.id] === 'completed' ? 'notStarted' : 'completed')))}
                        className="rounded-[4px] border border-line2 px-1.5 font-mono text-[10px] text-tx3 hover:text-tx"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-1">
            <Label>FLAG</Label>
            {p.flags.map((f) => (
              <Toggle key={f.id} checked={state.flags[f.id] ?? false} label={<span className="font-mono text-[12px]">{f.name}</span>} onChange={(v) => commit(updateState(p, state, (x) => void (x.flags[f.id] = v)), `Debug: ${f.name} = ${v}`)} />
            ))}
          </div>

          {customLeaves.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>CONDIZIONI PERSONALIZZATE</Label>
              {customLeaves.map(([key, text]) => (
                <Toggle key={key} checked={state.manual[key] ?? false} label={text} onChange={(v) => commit(updateState(p, state, (x) => void (x.manual[key] = v)))} />
              ))}
            </div>
          )}

          {ending && path && (
            <div className="mt-auto flex items-center gap-2 rounded-lg border p-3 text-[12.5px]" style={{ borderColor: ending.color }}>
              <Flag size={13} style={{ color: ending.color }} />
              {state.sceneId && path.sceneIds.has(state.sceneId) ? (
                <span>
                  Ancora sul percorso di <b style={{ color: ending.color }}>{ending.label}</b>
                </span>
              ) : (
                <span className="text-tx3">Fuori dal percorso di {ending.label}</span>
              )}
            </div>
          )}
          {state.sceneId && <span className="text-[11px] text-tx3">{TAG_META[scene!.tag].label} · {state.visited.length} scene visitate</span>}
        </aside>
      </div>
    </div>
  )
}
