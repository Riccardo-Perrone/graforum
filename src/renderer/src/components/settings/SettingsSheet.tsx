import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { RotateCcw, Trash2, X } from 'lucide-react'
import { buildUsageIndex, newId, type CustomConditionType, type CustomFieldDef, type Skill } from '@shared/model'
import { decisivePath } from '@shared/engine'
import { COMMANDS, useKbd, comboFor, comboFromEvent, findConflict, formatCombo, type CommandDef, type CommandId } from '../../lib/commands'
import { apply, options, useProject } from '../../lib/entities'
import { openEntity, useUiStore, type SettingsPage } from '../../store/ui'
import { EntityChip } from '../logic/EntityChip'
import { UpdateCard } from '../shell/UpdateCard'
import { ENDING_COLORS } from '@shared/model'
import { Combobox } from '../ui/Combobox'
import { AddButton, Field, Segmented, Select, TextArea, TextInput, Toggle } from '../ui/form'
import { IconButton, Kbd, cn } from '../ui/primitives'
import { Empty, Section, Sheet } from '../ui/Sheet'

// Impostazioni del progetto (6c) più preferenze dell'app (Aspetto).

const PAGES: [SettingsPage, string][] = [
  ['general', 'Generale'],
  ['appearance', 'Aspetto'],
  ['skills', 'Abilità'],
  ['itemTypes', 'Tipi di oggetto'],
  ['customFields', 'Campi custom'],
  ['conditionTypes', 'Tipi di condizione'],
  ['endings', 'Finali'],
  ['flags', 'Flag'],
  ['shortcuts', 'Scorciatoie'],
  ['updates', 'Aggiornamenti']
]

const ABILITY_OPTIONS = [
  ['str', 'Forza'],
  ['dex', 'Destrezza'],
  ['con', 'Costituzione'],
  ['int', 'Intelligenza'],
  ['wis', 'Saggezza'],
  ['cha', 'Carisma']
] as const

function Page({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-col px-6 pt-5">
      <h2 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{title}</h2>
      <p className="mt-1 mb-2 text-tx3">{sub}</p>
      {children}
    </div>
  )
}

function General() {
  const p = useProject()
  return (
    <Page title="Generale" sub="Nome, descrizione e scena di partenza del progetto.">
      <Section n={1} label="Progetto">
        <Field label="Nome">
          <TextInput value={p.name} onCommit={(v) => v.trim() && apply('Nome progetto', (d) => void (d.name = v.trim()))} />
        </Field>
        <Field label="Descrizione">
          <TextArea rows={3} value={p.description} onCommit={(v) => apply('Descrizione progetto', (d) => void (d.description = v))} />
        </Field>
      </Section>
      <Section n={2} label="Avvio">
        <Field label="Scena di partenza">
          <Combobox allowClear value={p.startSceneId} options={options(p, 'scene')} onChange={(id) => apply('Scena di partenza', (d) => void (d.startSceneId = id))} />
        </Field>
        <Field label="Oggetto usato come denaro" hint="i prezzi dei negozi sono quantità di questo oggetto">
          <Combobox allowClear value={p.settings.currencyItemId} options={options(p, 'item')} onChange={(id) => apply('Valuta', (d) => void (d.settings.currencyItemId = id))} />
        </Field>
      </Section>
    </Page>
  )
}

function Appearance() {
  const { theme, uiScale, textScale, snap, setPrefs } = useUiStore()
  const kbdTheme = useKbd('toggleTheme')
  const scales = [0.8, 0.9, 1, 1.1, 1.25, 1.5]
  return (
    <Page title="Aspetto" sub="Preferenze di questo computer, valide per tutti i progetti.">
      <Section n={1} label="Tema">
        <Segmented
          className="w-[360px]"
          value={theme}
          options={[
            ['dark', 'Scuro'],
            ['light', 'Chiaro'],
            ['system', 'Segui sistema']
          ]}
          onChange={(t) => setPrefs({ theme: t })}
        />
        <span className="text-[12px] text-tx3">
          Anche dall’icona nella barra del titolo{kbdTheme && <> o con <Kbd>{kbdTheme}</Kbd></>}.
        </span>
      </Section>
      <Section n={2} label="Scala dell’interfaccia">
        <span className="text-[12px] text-tx3">Ingrandisce barre, pannelli e finestre. Utile su schermi con ridimensionamento al 125–150%.</span>
        <Segmented className="w-[480px]" value={String(uiScale)} options={scales.map((s) => [String(s), `${Math.round(s * 100)}%`] as const)} onChange={(v) => setPrefs({ uiScale: Number(v) })} />
      </Section>
      <Section n={3} label="Dimensione del testo">
        <span className="text-[12px] text-tx3">Ingrandisce il contenuto di schede e pannelli laterali senza toccare il grafo.</span>
        <Segmented className="w-[480px]" value={String(textScale)} options={scales.map((s) => [String(s), `${Math.round(s * 100)}%`] as const)} onChange={(v) => setPrefs({ textScale: Number(v) })} />
      </Section>
      <Section n={4} label="Aggancio dei nodi">
        <Toggle checked={snap} label="Aggancia i nodi mentre li trascini" sub="Si allineano ai bordi e al centro degli altri nodi. Tieni premuto Alt per sospenderlo." onChange={(v) => setPrefs({ snap: v })} />
      </Section>
    </Page>
  )
}

function Skills() {
  const p = useProject()
  // Un'abilità usata da una prova non si può eliminare.
  const used = (id: string) => JSON.stringify([p.links, p.dialogs, p.scenes]).includes(`"skillId":"${id}"`)
  const set = (i: number, recipe: (s: Skill) => void) => apply('Abilità', (d) => recipe(d.settings.skills[i]!))
  return (
    <Page title="Abilità" sub="Elenco usato dagli skill check. Le caratteristiche pure (es. Forza) valgono come prove di caratteristica.">
      <Section n={1} label={`Abilità · ${p.settings.skills.length}`}>
        <div className="grid grid-cols-2 gap-1.5">
          {p.settings.skills.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <TextInput className="h-7 flex-1" value={s.name} onCommit={(v) => set(i, (x) => void (x.name = v))} />
              <Select className="h-7 w-[130px]" value={s.ability} options={ABILITY_OPTIONS} onChange={(v) => set(i, (x) => void (x.ability = v))} />
              <IconButton
                icon={Trash2}
                size={12}
                disabled={used(s.id)}
                title={used(s.id) ? 'Usata da una prova' : 'Elimina'}
                onClick={() => apply('Elimina abilità', (d) => void d.settings.skills.splice(i, 1))}
              />
            </div>
          ))}
        </div>
        <div>
          <AddButton onClick={() => apply('Nuova abilità', (d) => void d.settings.skills.push({ id: newId('skill'), name: 'Nuova abilità', ability: 'str' }))}>Abilità</AddButton>
        </div>
      </Section>
    </Page>
  )
}

function ItemTypes() {
  const p = useProject()
  return (
    <Page title="Tipi di oggetto" sub="Elenco configurabile: si parte da arma, armatura, chiave, consumabile, oggetto di quest.">
      <Section n={1} label="Tipi">
        <div className="flex flex-wrap gap-1.5">
          {p.settings.itemTypes.map((t, i) => {
            const n = p.items.filter((x) => x.typeId === t.id).length
            return (
              <span key={t.id} className="flex items-center gap-1 rounded-md border border-line2 py-0.5 pr-1 pl-1">
                <TextInput className="h-6 w-[140px] border-transparent bg-transparent" value={t.name} onCommit={(v) => apply('Tipo oggetto', (d) => void (d.settings.itemTypes[i]!.name = v))} />
                <span className="font-mono text-[10px] text-tx3">{n}</span>
                <IconButton icon={Trash2} size={12} disabled={n > 0} title={n ? 'Usato da oggetti' : 'Elimina'} onClick={() => apply('Elimina tipo', (d) => void d.settings.itemTypes.splice(i, 1))} />
              </span>
            )
          })}
          <AddButton onClick={() => apply('Nuovo tipo', (d) => void d.settings.itemTypes.push({ id: newId('itemType'), name: 'Nuovo tipo' }))}>Tipo</AddButton>
        </div>
      </Section>
    </Page>
  )
}

function CustomFields() {
  const p = useProject()
  const set = (id: string, recipe: (f: CustomFieldDef) => void) => apply('Campo custom', (d) => recipe(d.settings.customFields.find((f) => f.id === id)!))
  return (
    <Page title="Campi custom" sub="Campi aggiuntivi per NPC, enemy e oggetti: testo, numero, sì/no o scelta da elenco.">
      {(['npc', 'enemy', 'item'] as const).map((kind, k) => {
        const list = p.settings.customFields.filter((f) => f.appliesTo === kind)
        return (
          <Section key={kind} n={k + 1} label={kind === 'npc' ? 'NPC' : kind === 'enemy' ? 'Enemy' : 'Oggetti'}>
            {list.length === 0 && <Empty>Nessun campo.</Empty>}
            {list.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <TextInput className="h-7 w-[200px]" value={f.name} onCommit={(v) => set(f.id, (x) => void (x.name = v))} />
                <Select
                  className="h-7 w-[120px]"
                  value={f.kind}
                  options={[
                    ['text', 'Testo'],
                    ['number', 'Numero'],
                    ['boolean', 'Sì / no'],
                    ['choice', 'Scelta']
                  ]}
                  onChange={(v) => set(f.id, (x) => void (x.kind = v))}
                />
                {f.kind === 'choice' && (
                  <TextInput className="h-7 flex-1" placeholder="Opzioni separate da virgola" value={f.options.join(', ')} onCommit={(v) => set(f.id, (x) => void (x.options = v.split(',').map((o) => o.trim()).filter(Boolean)))} />
                )}
                <span className="flex-1" />
                <IconButton icon={Trash2} size={12} onClick={() => apply('Elimina campo', (d) => void (d.settings.customFields = d.settings.customFields.filter((x) => x.id !== f.id)))} />
              </div>
            ))}
            <div>
              <AddButton onClick={() => apply('Nuovo campo', (d) => void d.settings.customFields.push({ id: newId('customField'), appliesTo: kind, name: 'Nuovo campo', kind: 'text', options: [] }))}>Campo</AddButton>
            </div>
          </Section>
        )
      })}
    </Page>
  )
}

function ConditionTypes() {
  const p = useProject()
  const set = (id: string, recipe: (t: CustomConditionType) => void) => apply('Tipo di condizione', (d) => recipe(d.settings.conditionTypes.find((x) => x.id === id)!))
  return (
    <Page title="Tipi di condizione" sub="Condizioni personali riusabili (es. “Reputazione con fazione ≥ N”). Nel playtest si segnano a mano come vere o false.">
      {p.settings.conditionTypes.length === 0 && <Empty>Nessun tipo custom.</Empty>}
      {p.settings.conditionTypes.map((t, k) => (
        <Section key={t.id} n={k + 1} label={t.name} right={<IconButton icon={Trash2} size={13} onClick={() => apply('Elimina tipo', (d) => void (d.settings.conditionTypes = d.settings.conditionTypes.filter((x) => x.id !== t.id)))} />}>
          <div className="grid grid-cols-[220px_1fr] gap-2">
            <TextInput value={t.name} onCommit={(v) => set(t.id, (x) => void (x.name = v))} />
            <TextInput placeholder="Descrizione" value={t.description} onCommit={(v) => set(t.id, (x) => void (x.description = v))} />
          </div>
          {t.params.map((prm, i) => (
            <div key={i} className="flex items-center gap-1.5 pl-3">
              <TextInput className="h-7 w-[180px]" value={prm.label} onCommit={(v) => set(t.id, (x) => void (x.params[i]!.label = v))} />
              <Select
                className="h-7 w-[130px]"
                value={prm.kind}
                options={[
                  ['text', 'Testo'],
                  ['number', 'Numero'],
                  ['boolean', 'Sì / no'],
                  ['entity', 'Entità']
                ]}
                onChange={(v) => set(t.id, (x) => void ((x.params[i]!.kind = v), (x.params[i]!.entityType = v === 'entity' ? 'npc' : null)))}
              />
              {prm.kind === 'entity' && (
                <Select
                  className="h-7 w-[130px]"
                  value={prm.entityType ?? 'npc'}
                  options={[
                    ['npc', 'NPC'],
                    ['enemy', 'Enemy'],
                    ['item', 'Oggetto'],
                    ['quest', 'Quest'],
                    ['scene', 'Scena'],
                    ['group', 'Gruppo']
                  ]}
                  onChange={(v) => set(t.id, (x) => void (x.params[i]!.entityType = v))}
                />
              )}
              <IconButton icon={Trash2} size={12} onClick={() => set(t.id, (x) => void x.params.splice(i, 1))} />
            </div>
          ))}
          <div className="pl-3">
            <AddButton onClick={() => set(t.id, (x) => void x.params.push({ key: `p${x.params.length + 1}_${Date.now() % 1000}`, label: 'Parametro', kind: 'text', entityType: null }))}>Parametro</AddButton>
          </div>
        </Section>
      ))}
      <div className="py-3">
        <AddButton onClick={() => apply('Nuovo tipo di condizione', (d) => void d.settings.conditionTypes.push({ id: newId('conditionType'), name: 'Nuova condizione', description: '', params: [] }))}>Tipo di condizione</AddButton>
      </div>
    </Page>
  )
}

function Endings() {
  const p = useProject()
  return (
    <Page title="Finali" sub="Etichetta e colore di ogni finale. Il colore evidenzia il percorso decisivo nel grafo.">
      <div className="overflow-hidden rounded-lg border border-line2">
        <div className="grid grid-cols-[56px_1fr_1fr_110px_100px_36px] gap-3 border-b border-line bg-sunken px-3 py-2 font-mono text-[10px] text-tx3">
          <span>COLORE</span>
          <span>ETICHETTA</span>
          <span>SCENA</span>
          <span>PERCORSO</span>
          <span>DECISIVE</span>
          <span />
        </div>
        {p.endings.length === 0 && <div className="p-3 text-tx3">Nessun finale: attiva “Scena finale” nella scheda di una scena.</div>}
        {p.endings.map((e, i) => (
          <div key={e.id} className="grid grid-cols-[56px_1fr_1fr_110px_100px_36px] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
            <div className="flex flex-wrap gap-1">
              {ENDING_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => apply('Colore finale', (d) => void (d.endings[i]!.color = c))} className={cn('size-3.5 rounded-[3px]', e.color === c && 'shadow-[0_0_0_1.5px_var(--tx)]')} style={{ background: c }} />
              ))}
            </div>
            <TextInput className="h-7" value={e.label} onCommit={(v) => apply('Etichetta finale', (d) => void (d.endings[i]!.label = v))} />
            <EntityChip type="scene" id={e.sceneId} />
            <button type="button" className="text-left font-mono text-[11px] text-ac hover:underline" onClick={() => (useUiStore.getState().setPathEnding(e.id), useUiStore.getState().openSheet(null))}>
              {decisivePath(p, e.id).sceneIds.size} scene →
            </button>
            <span className="font-mono text-[11px] text-tx3">{e.manualDecisive.length} a mano</span>
            <IconButton icon={Trash2} size={12} onClick={() => apply('Elimina finale', (d) => void d.endings.splice(i, 1))} />
          </div>
        ))}
      </div>
      <span className="mt-2 text-[12px] text-tx3">Tavolozza testata su entrambi i temi.</span>
    </Page>
  )
}

function Flags() {
  const p = useProject()
  const usage = useMemo(() => buildUsageIndex(p), [p])
  return (
    <Page title="Flag" sub="Valori sì/no impostati dagli effetti e letti dalle condizioni (es. cantina_visitata).">
      <div className="flex flex-col gap-1.5">
        {p.flags.length === 0 && <Empty>Nessun flag.</Empty>}
        {p.flags.map((f, i) => {
          const used = usage.get(f.id) ?? []
          return (
            <div key={f.id} className="flex items-center gap-2 rounded-lg border border-line2 bg-raised px-2.5 py-1.5">
              <TextInput className="h-7 w-[200px] font-mono" value={f.name} onCommit={(v) => apply('Nome flag', (d) => void (d.flags[i]!.name = v))} />
              <TextInput className="h-7 flex-1" placeholder="Descrizione" value={f.description} onCommit={(v) => apply('Descrizione flag', (d) => void (d.flags[i]!.description = v))} />
              <Toggle checked={f.defaultValue} onChange={(v) => apply('Valore iniziale flag', (d) => void (d.flags[i]!.defaultValue = v))} />
              <button type="button" className="w-[60px] font-mono text-[10.5px] text-tx3 hover:text-ac" onClick={() => used[0] && openEntity(used[0].type, used[0].id)}>
                {used.length} usi
              </button>
              <IconButton
                icon={Trash2}
                size={12}
                onClick={() => (used.length ? useUiStore.getState().showBlocked({ name: f.name, owners: used }) : apply('Elimina flag', (d) => void d.flags.splice(i, 1)))}
              />
            </div>
          )
        })}
        <div>
          <AddButton onClick={() => apply('Nuovo flag', (d) => void d.flags.push({ id: newId('flag'), name: `flag_${d.flags.length + 1}`, description: '', defaultValue: false }))}>Flag</AddButton>
        </div>
      </div>
    </Page>
  )
}

/** Riga di una scorciatoia: clic sulla combinazione, poi premi i tasti nuovi. */
function ShortcutRow({ cmd }: { cmd: CommandDef }) {
  const shortcuts = useUiStore((st) => st.shortcuts)
  const setPrefs = useUiStore((st) => st.setPrefs)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const combo = comboFor(cmd.id as CommandId, shortcuts)
  const custom = cmd.id in shortcuts

  const assign = (value: string) => {
    const next = { ...shortcuts }
    if (value === cmd.combo) delete next[cmd.id]
    else next[cmd.id] = value
    setPrefs({ shortcuts: next })
  }

  useEffect(() => {
    if (!listening) return
    // In ascolto la tastiera è solo nostra: nessun altro comando (né Esc che chiude la finestra) deve scattare.
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const value = comboFromEvent(e)
      if (!value) return
      const clash = findConflict(cmd.id, value, shortcuts)
      if (clash) {
        setError(`Già usata da «${clash.label}»`)
        return
      }
      assign(value)
      setError(null)
      setListening(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, shortcuts])

  return (
    <div className="flex min-h-[34px] items-center gap-2 border-b border-line py-1">
      <span className="min-w-0 flex-1">{cmd.label}</span>
      {error && <span className="text-[11.5px] text-err">{error}</span>}
      <button
        type="button"
        onClick={() => (setListening(!listening), setError(null))}
        onBlur={() => (setListening(false), setError(null))}
        title="Clic, poi premi la nuova combinazione"
        className={cn('h-7 min-w-[132px] rounded-md border px-2.5 font-mono text-[11px]', listening ? 'border-ac bg-acbg text-ac' : 'border-line2 bg-raised hover:bg-hover', custom && !listening && 'text-ac')}
      >
        {listening ? 'Premi i tasti…' : combo ? formatCombo(combo) : 'Nessuna'}
      </button>
      <IconButton icon={X} size={13} title="Togli la scorciatoia" disabled={!combo} onMouseDown={(e) => e.preventDefault()} onClick={() => assign('')} />
      <IconButton icon={RotateCcw} size={13} title="Ripristina il valore predefinito" disabled={!custom} onMouseDown={(e) => e.preventDefault()} onClick={() => (setError(null), assign(cmd.combo))} />
    </div>
  )
}

function Shortcuts() {
  const resetAll = () => useUiStore.getState().setPrefs({ shortcuts: {} })
  const groups = [...new Set(COMMANDS.map((c) => c.group))]
  return (
    <Page title="Scorciatoie" sub="Clic su una combinazione e premi i nuovi tasti. Le modifiche si salvano da sole, valgono per tutti i progetti.">
      <div className="flex max-w-[680px] flex-col gap-5">
        {groups.map((g, i) => (
          <Section key={g} n={i + 1} label={g}>
            <div className="flex flex-col">
              {COMMANDS.filter((c) => c.group === g).map((c) => (
                <ShortcutRow key={c.id} cmd={c} />
              ))}
            </div>
          </Section>
        ))}
        <div>
          <button type="button" onClick={resetAll} className="flex h-8 items-center gap-1.5 rounded-md border border-line2 px-3 text-[12.5px] hover:bg-hover">
            <RotateCcw size={13} />
            Ripristina tutte
          </button>
        </div>
      </div>
    </Page>
  )
}

function Updates() {
  const autoCheckUpdates = useUiStore((s) => s.autoCheckUpdates)
  const setPrefs = useUiStore((s) => s.setPrefs)
  return (
    <Page title="Aggiornamenti" sub="Cerca nuove versioni di Graforum. I tuoi progetti (.dng) non vengono toccati dall’aggiornamento.">
      <Section n={1} label="Versione">
        <UpdateCard className="max-w-[520px]" />
      </Section>
      <Section n={2} label="All’avvio">
        <Toggle checked={autoCheckUpdates} label="Cerca gli aggiornamenti quando si apre l’app" sub="Controlla soltanto: il download parte solo se premi «Scarica e aggiorna»." onChange={(v) => setPrefs({ autoCheckUpdates: v })} />
      </Section>
    </Page>
  )
}

export function SettingsSheet({ page }: { page: SettingsPage }) {
  const p = useProject()
  const ui = useUiStore()
  return (
    <Sheet category="Impostazioni" title={p.name} width={1200} height={860} onClose={() => ui.openSheet(null)} bodyClassName="flex" footer={<span>Le impostazioni del progetto si salvano nel file .dng</span>}>
      <nav className="flex w-[240px] flex-none flex-col gap-0.5 border-r border-line p-3">
        {PAGES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => ui.openSheet({ kind: 'settings', page: k })} className={cn('rounded-md px-2.5 py-1.5 text-left hover:bg-hover', page === k && 'bg-acbg text-ac')}>
            {label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto pb-6" data-text-scale>
        {page === 'general' && <General />}
        {page === 'appearance' && <Appearance />}
        {page === 'skills' && <Skills />}
        {page === 'itemTypes' && <ItemTypes />}
        {page === 'customFields' && <CustomFields />}
        {page === 'conditionTypes' && <ConditionTypes />}
        {page === 'endings' && <Endings />}
        {page === 'flags' && <Flags />}
        {page === 'shortcuts' && <Shortcuts />}
        {page === 'updates' && <Updates />}
      </div>
    </Sheet>
  )
}

