import { useState } from 'react'
import { Dices, Lock, RotateCcw, Zap } from 'lucide-react'
import type { Dialog, DialogChoice } from '@shared/model'
import { applyEffects, describeCondition, describeEffect, gateStatus, initialPlayState, updateState, type PlayState } from '@shared/engine'
import { Button, Select, Toggle } from '../components/ui/form'
import { Sheet } from '../components/ui/Sheet'
import { cn } from '../components/ui/primitives'
import { useProject } from '../lib/entities'

/** "Prova dialogo": percorre un solo dialogo con lo stato di un preset, valutando condizioni ed effetti. */
export function DialogRunner({ dialog, onClose }: { dialog: Dialog; onClose(): void }) {
  const p = useProject()
  const [presetId, setPresetId] = useState('')
  const start = () => initialPlayState(p, p.presets.find((x) => x.id === presetId))
  const [state, setState] = useState<PlayState>(start)
  const [lineId, setLineId] = useState<string | null>(dialog.startLineId)
  const [log, setLog] = useState<string[]>([])
  const [ignoreConditions, setIgnore] = useState(false)
  const [pending, setPending] = useState<DialogChoice | null>(null)
  const line = dialog.lines.find((l) => l.id === lineId)
  const npc = p.npcs.find((n) => n.id === dialog.npcId)

  const restart = (pid = presetId) => {
    setState(initialPlayState(p, p.presets.find((x) => x.id === pid)))
    setLineId(dialog.startLineId)
    setLog([])
    setPending(null)
  }

  const go = (choice: DialogChoice, outcome?: 'success' | 'failure') => {
    let s = updateState(p, state, (x) => {
      x.choices.push(choice.id)
      if (npc && !x.talkedTo.includes(npc.id)) x.talkedTo.push(npc.id)
      if (outcome === 'success' && choice.check) x.passedChecks.push(choice.check.id)
    })
    const fx = [...choice.effects, ...(choice.check && outcome ? choice.check[outcome].effects : [])]
    s = applyEffects(p, s, fx)
    const target = choice.check && outcome ? (choice.check[outcome].target?.id ?? (outcome === 'success' ? choice.targetLineId : null)) : choice.targetLineId
    const next = dialog.lines.find((l) => l.id === target)
    if (next) s = applyEffects(p, s, next.effects)
    else s = updateState(p, s, (x) => void (!x.completedDialogs.includes(dialog.id) && x.completedDialogs.push(dialog.id)))
    setLog((l) => [...l, `› ${choice.text}${outcome ? ` (${outcome === 'success' ? 'riuscita' : 'fallimento'})` : ''}`, ...fx.map((e) => `   ${describeEffect(p, e)}`)])
    setState(s)
    setLineId(next?.id ?? null)
    setPending(null)
  }

  const speaker = line ? (line.speaker.kind === 'npc' ? (npc?.name ?? 'NPC') : line.speaker.kind === 'player' ? 'Giocatore' : line.speaker.name) : ''

  return (
    <Sheet level={1} category="Prova dialogo" title={dialog.title} subtitle={npc?.name} width={980} height={760} onClose={onClose} bodyClassName="flex">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {line ? (
          <>
            <div className="flex flex-col gap-2 rounded-xl border border-line2 bg-raised p-5">
              <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">{speaker.toUpperCase()}</span>
              <p className="m-0 text-[15px] leading-[1.65]">{line.text || '…'}</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">SCELTE</span>
              {line.choices.length === 0 && (
                <Button onClick={() => (setLog((l) => [...l, '— fine del dialogo']), setLineId(null), setState(updateState(p, state, (x) => void x.completedDialogs.push(dialog.id))))}>
                  Fine del dialogo
                </Button>
              )}
              {line.choices.map((c) => {
                const status = ignoreConditions ? 'open' : gateStatus(p, state, c.gate, c.id)
                if (status === 'hidden')
                  return (
                    <div key={c.id} className="rounded-lg border border-dashed border-line2 px-3 py-2 text-[12px] text-tx3">
                      Nascosta: {describeCondition(p, c.gate.condition)}
                    </div>
                  )
                return (
                  <div key={c.id} className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={status === 'locked'}
                      onClick={() => (c.check ? setPending(c) : go(c))}
                      className={cn('flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left', status === 'locked' ? 'border-dashed border-line2 text-tx3' : 'border-acln bg-acbg hover:brightness-125')}
                    >
                      {status === 'locked' && <Lock size={12} />}
                      <span className="flex-1">{c.text || '(vuota)'}</span>
                      {c.check && (
                        <span className="flex items-center gap-1 font-mono text-[10.5px]">
                          <Dices size={12} />
                          {p.settings.skills.find((s) => s.id === c.check!.skillId)?.name} CD {c.check.dc}
                        </span>
                      )}
                    </button>
                    {status === 'locked' && c.gate.lockedMessage && <span className="pl-4 text-[12px] text-tx3">{c.gate.lockedMessage}</span>}
                    {pending?.id === c.id && (
                      <div className="flex items-center gap-2 pl-4">
                        <span className="text-[12px] text-tx3">Esito del tiro:</span>
                        <Button className="h-7 border-safe/50 text-safe" onClick={() => go(c, 'success')}>
                          Riuscita
                        </Button>
                        <Button className="h-7 border-err/50 text-err" onClick={() => go(c, 'failure')}>
                          Fallimento
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-tx3">
            Dialogo concluso.
            <Button onClick={() => restart()}>
              <RotateCcw size={13} /> Ricomincia
            </Button>
          </div>
        )}
      </div>
      <aside className="flex w-[320px] flex-none flex-col gap-4 overflow-y-auto border-l border-line bg-sunken p-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">STATO DI PARTENZA</span>
          <Select
            value={presetId}
            options={[['', 'Inventario vuoto'] as const, ...p.presets.map((x) => [x.id, x.name] as const)]}
            onChange={(v) => {
              setPresetId(v)
              restart(v)
            }}
          />
          <Toggle checked={ignoreConditions} onChange={setIgnore} label="Ignora le condizioni" sub="Mostra tutte le scelte" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">INVENTARIO</span>
          {Object.keys(state.inventory).length === 0 && <span className="text-[12px] text-tx3">Vuoto</span>}
          {Object.entries(state.inventory).map(([id, q]) => (
            <span key={id} className="flex justify-between text-[12px]">
              {p.items.find((i) => i.id === id)?.name}
              <span className="font-mono text-tx3">×{q}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">REGISTRO</span>
          {log.length === 0 && <span className="text-[12px] text-tx3">Nessuna scelta ancora.</span>}
          {log.map((l, i) => (
            <span key={i} className={cn('font-mono text-[11px] whitespace-pre-wrap', l.startsWith('   ') ? 'text-ac' : 'text-tx2')}>
              {l.startsWith('   ') && <Zap size={10} className="mr-1 inline" />}
              {l.trim()}
            </span>
          ))}
        </div>
        <Button className="mt-auto" onClick={() => restart()}>
          <RotateCcw size={13} /> Ricomincia
        </Button>
      </aside>
    </Sheet>
  )
}
