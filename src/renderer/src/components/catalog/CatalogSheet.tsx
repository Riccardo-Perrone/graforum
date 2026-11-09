import { useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, Flag, Highlighter, ImageIcon, Lock, MessagesSquare, Plus, Trash2 } from 'lucide-react'
import { buildUsageIndex, newId, type Enemy, type Item, type Npc, type Project, type Quest } from '@shared/model'
import { describeCondition, effectSites, leaves, sourcesOf, stepsSatisfiedBy } from '@shared/engine'
import { apply, createEntity, emptyGate, options, useProject } from '../../lib/entities'
import { openEntity, useUiStore, type CatalogType } from '../../store/ui'
import { ImagePicker, ImageThumb } from '../images/ImagePicker'
import { ConditionTree } from '../logic/ConditionEditor'
import { EntityChip } from '../logic/EntityChip'
import { GateButton } from '../logic/GateButton'
import { UsageList } from '../logic/UsageList'
import { confirmDialog } from '../ui/ConfirmDialog'
import { Combobox } from '../ui/Combobox'
import { AddButton, Button, NumberInput, Select, TextArea, TextInput, Toggle } from '../ui/form'
import { IconButton, cn } from '../ui/primitives'
import { Empty, Row, Section, Sheet } from '../ui/Sheet'
import { ABILITIES, BonusList, CustomFields, ItemQtyList, KeyValue, ListInput, NamedList, modifier } from './fields'

const CATEGORY: Record<CatalogType, string> = { npc: 'NPC', enemy: 'Enemy', item: 'Oggetto', quest: 'Quest' }
const LIST_KEY = { npc: 'npcs', enemy: 'enemies', item: 'items', quest: 'quests' } as const

type Creature = Npc | Enemy

function update(type: CatalogType, id: string, label: string, recipe: (e: any) => void) {
  apply(label, (d) => {
    const e = (d[LIST_KEY[type]] as { id: string }[]).find((x) => x.id === id)
    if (e) recipe(e)
  })
}

function Portrait({ imageId, aspect, onPick }: { imageId: string | null; aspect: string; onPick(id: string | null): void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <ImageThumb id={imageId} className={aspect} />
      <button type="button" onClick={() => setOpen(true)} className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-md border border-line2 bg-panel hover:bg-hover" title="Scegli o carica">
        <ImageIcon size={13} />
      </button>
      {open && <ImagePicker value={imageId} onPick={onPick} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** Statistiche: 6 caselle caratteristica + PF, CA, VEL. */
function Stats({ c, type }: { c: Creature; type: CatalogType }) {
  return (
    <div className="flex items-stretch gap-1.5">
      {ABILITIES.map(([k, label]) => (
        <div key={k} className="flex w-[62px] flex-col items-center gap-0.5 rounded-lg border border-line2 bg-raised px-1 py-1.5">
          <span className="font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">{label}</span>
          <NumberInput className="h-6 w-full border-transparent bg-transparent px-0 text-center text-[17px] font-semibold" value={c.abilities[k]} onCommit={(v) => update(type, c.id, 'Caratteristica', (e) => void (e.abilities[k] = v ?? 10))} />
          <span className="font-mono text-[10px] text-tx3">{modifier(c.abilities[k])}</span>
        </div>
      ))}
      <span className="mx-1 w-px bg-line2" />
      {(
        [
          ['PF', 'hp'],
          ['CA', 'ac']
        ] as const
      ).map(([label, k]) => (
        <div key={k} className="flex w-[62px] flex-col items-center gap-0.5 rounded-lg border border-line2 bg-raised px-1 py-1.5">
          <span className="font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">{label}</span>
          <NumberInput allowNull className="h-6 w-full border-transparent bg-transparent px-0 text-center text-[17px] font-semibold" value={c[k]} onCommit={(v) => update(type, c.id, label, (e) => void (e[k] = v))} />
        </div>
      ))}
      <div className="flex w-[78px] flex-col items-center gap-0.5 rounded-lg border border-line2 bg-raised px-1 py-1.5">
        <span className="font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">VEL</span>
        <TextInput className="h-6 w-full border-transparent bg-transparent px-0 text-center text-[14px] font-semibold" value={c.speed} onCommit={(v) => update(type, c.id, 'Velocità', (e) => void (e.speed = v))} />
      </div>
    </div>
  )
}

function CreatureLeft({ c, type }: { c: Creature; type: 'npc' | 'enemy' }) {
  const t = (label: string, key: keyof Creature) => [
    label,
    <TextInput key={key} className="h-7" value={String(c[key] ?? '')} onCommit={(v) => update(type, c.id, label, (e) => void (e[key] = v))} />
  ] as [string, ReactNode]
  const rows: [string, ReactNode][] = [
    t('Razza/specie', 'race'),
    t('Genere', 'gender'),
    t('Età', 'age'),
    t('Allineamento', 'alignment'),
    t('Fazione', 'faction'),
    t('Ruolo', 'role'),
    t(type === 'enemy' ? 'GS' : 'Livello', 'level'),
    t('Taglia', 'size'),
    ...(type === 'enemy' ? [t('Tipo creatura', 'creatureType' as keyof Creature), t('Ambiente', 'environment' as keyof Creature)] : []),
    ['Tag', <ListInput key="tags" value={c.tags} onCommit={(v) => update(type, c.id, 'Tag', (e) => void (e.tags = v))} />]
  ]
  return (
    <div className="flex flex-col gap-4">
      <Portrait imageId={c.imageId} aspect="aspect-[4/5]" onPick={(id) => update(type, c.id, 'Ritratto', (e) => void (e.imageId = id))} />
      <KeyValue rows={rows} />
    </div>
  )
}

function CreatureBody({ c, type }: { c: Creature; type: 'npc' | 'enemy' }) {
  const p = useProject()
  let n = 0
  const npc = type === 'npc' ? (c as Npc) : null
  const dialogs = npc ? p.dialogs.filter((d) => d.npcId === npc.id) : []
  const contextOnly = (id: string) => {
    const d = p.dialogs.find((x) => x.id === id)!
    return d.lines.every((l) => l.effects.length === 0 && l.choices.every((ch) => ch.effects.length === 0 && !ch.check))
  }
  return (
    <>
      <Section n={++n} label="Descrizione">
        <TextArea rows={3} placeholder="Descrizione generale" value={c.description} onCommit={(v) => update(type, c.id, 'Descrizione', (e) => void (e.description = v))} />
        <div className="grid grid-cols-2 gap-2">
          <TextArea rows={2} placeholder="Aspetto" value={c.appearance} onCommit={(v) => update(type, c.id, 'Aspetto', (e) => void (e.appearance = v))} />
          <TextArea rows={2} placeholder="Personalità" value={c.personality} onCommit={(v) => update(type, c.id, 'Personalità', (e) => void (e.personality = v))} />
        </div>
      </Section>
      <Section n={++n} label="Statistiche">
        <Stats c={c} type={type} />
      </Section>
      <Section n={++n} label="Abilità e tiri salvezza">
        <BonusList noun="Abilità" items={c.skills} onChange={(v) => update(type, c.id, 'Abilità', (e) => void (e.skills = v))} />
        <BonusList noun="Tiro salvezza" items={c.savingThrows} onChange={(v) => update(type, c.id, 'Tiri salvezza', (e) => void (e.savingThrows = v))} />
      </Section>
      <Section n={++n} label="Combattimento">
        <div className="overflow-hidden rounded-lg border border-line2">
          <div className="grid grid-cols-[1.4fr_70px_1fr_1fr_90px_30px] gap-2 border-b border-line bg-sunken px-2 py-1.5 font-mono text-[10px] text-tx3">
            <span>ATTACCO</span>
            <span>BONUS</span>
            <span>DANNO</span>
            <span>TIPO</span>
            <span>PORTATA</span>
            <span />
          </div>
          {c.attacks.map((a, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_70px_1fr_1fr_90px_30px] items-center gap-2 border-b border-line px-2 py-1 last:border-b-0">
              <TextInput className="h-7" value={a.name} onCommit={(v) => update(type, c.id, 'Attacco', (e) => void (e.attacks[i].name = v))} />
              <NumberInput className="h-7" value={a.bonus} onCommit={(v) => update(type, c.id, 'Attacco', (e) => void (e.attacks[i].bonus = v ?? 0))} />
              <TextInput className="h-7" value={a.damage} onCommit={(v) => update(type, c.id, 'Attacco', (e) => void (e.attacks[i].damage = v))} />
              <TextInput className="h-7" value={a.damageType} onCommit={(v) => update(type, c.id, 'Attacco', (e) => void (e.attacks[i].damageType = v))} />
              <TextInput className="h-7" value={a.reach} onCommit={(v) => update(type, c.id, 'Attacco', (e) => void (e.attacks[i].reach = v))} />
              <IconButton icon={Trash2} size={12} onClick={() => update(type, c.id, 'Attacco', (e) => void e.attacks.splice(i, 1))} />
            </div>
          ))}
        </div>
        <div>
          <AddButton onClick={() => update(type, c.id, 'Nuovo attacco', (e) => void e.attacks.push({ name: 'Attacco', bonus: 0, damage: '', damageType: '', reach: '' }))}>Attacco</AddButton>
        </div>
        <KeyValue
          rows={[
            ['Resistenze', <ListInput key="r" value={c.resistances} onCommit={(v) => update(type, c.id, 'Resistenze', (e) => void (e.resistances = v))} />],
            ['Immunità', <ListInput key="i" value={c.immunities} onCommit={(v) => update(type, c.id, 'Immunità', (e) => void (e.immunities = v))} />],
            ['Vulnerabilità', <ListInput key="v" value={c.vulnerabilities} onCommit={(v) => update(type, c.id, 'Vulnerabilità', (e) => void (e.vulnerabilities = v))} />]
          ]}
        />
      </Section>
      <Section n={++n} label="Tratti e abilità speciali">
        <NamedList noun="Tratto" items={c.traits} onChange={(v) => update(type, c.id, 'Tratti', (e) => void (e.traits = v))} />
      </Section>
      <Section n={++n} label="Incantesimi">
        <NamedList noun="Incantesimo" items={c.spells} onChange={(v) => update(type, c.id, 'Incantesimi', (e) => void (e.spells = v))} />
      </Section>
      <Section n={++n} label="Bottino">
        <KeyValue
          rows={[
            ['Equipaggiamento', <ListInput key="eq" value={c.equipment} onCommit={(v) => update(type, c.id, 'Equipaggiamento', (e) => void (e.equipment = v))} />],
            ['XP concessi', <NumberInput key="xp" min={0} value={c.loot.xp} onCommit={(v) => update(type, c.id, 'XP', (e) => void (e.loot.xp = v ?? 0))} />],
            ['Loot', <ItemQtyList key="loot" items={c.loot.items} onChange={(v) => update(type, c.id, 'Loot', (e) => void (e.loot.items = v))} />]
          ]}
        />
      </Section>
      <Section n={++n} label="Background e segreti">
        <TextArea rows={3} placeholder="Background" value={c.background} onCommit={(v) => update(type, c.id, 'Background', (e) => void (e.background = v))} />
        <TextArea rows={2} placeholder="Segreti" value={c.secrets} onCommit={(v) => update(type, c.id, 'Segreti', (e) => void (e.secrets = v))} />
      </Section>
      <Section n={++n} label="Campi custom">
        <CustomFields appliesTo={type} values={c.customFields} onChange={(v) => update(type, c.id, 'Campi custom', (e) => void (e.customFields = v))} />
      </Section>
      {npc && (
        <>
          <Section
            n={++n}
            label="Dialoghi"
            right={
              <AddButton
                onClick={() => {
                  const id = newId('dialog')
                  apply('Nuovo dialogo', (d) => void d.dialogs.push({ id, npcId: npc.id, title: 'Nuovo dialogo', startLineId: null, lines: [] }))
                  openEntity('dialog', id)
                }}
              >
                Nuovo dialogo
              </AddButton>
            }
          >
            {dialogs.length === 0 && <Empty>Nessun dialogo.</Empty>}
            {dialogs.map((d) => (
              <Row key={d.id} className={cn(contextOnly(d.id) && 'border-dashed bg-transparent')}>
                <MessagesSquare size={14} className="text-tx3" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.title}</div>
                  <div className="font-mono text-[10.5px] text-tx3">
                    {d.lines.length} battute · {d.lines.reduce((x, l) => x + l.choices.length, 0)} scelte
                    {contextOnly(d.id) ? ' · solo contesto' : ''}
                  </div>
                </div>
                <Button className="h-7" onClick={() => openEntity('dialog', d.id)}>
                  Apri editor <ExternalLink size={12} />
                </Button>
              </Row>
            ))}
          </Section>
          <Section n={++n} label="Servizi">
            <span className="text-[11.5px] text-tx3">Negozio: merce in vendita, prezzo in {p.items.find((i) => i.id === p.settings.currencyItemId)?.name ?? 'valuta (Impostazioni)'}</span>
            {npc.services.shop.map((s, i) => (
              <Row key={i}>
                <Combobox className="h-7 w-[200px]" value={s.itemId} options={options(p, 'item')} onCreate={(nm) => createEntity('item', nm)} onChange={(id) => id && update('npc', npc.id, 'Merce', (e) => void (e.services.shop[i].itemId = id))} />
                <span className="text-tx3">prezzo</span>
                <NumberInput className="h-7 w-20" min={0} value={s.price} onCommit={(v) => update('npc', npc.id, 'Prezzo', (e) => void (e.services.shop[i].price = v ?? 0))} />
                <span className="text-tx3">scorta</span>
                <NumberInput className="h-7 w-20" allowNull min={0} value={s.stock} onCommit={(v) => update('npc', npc.id, 'Scorta', (e) => void (e.services.shop[i].stock = v))} />
                <GateButton compact gate={s.gate} title="Quando la merce è disponibile" onChange={(g) => update('npc', npc.id, 'Condizione merce', (e) => void (e.services.shop[i].gate = g))} />
                <span className="flex-1" />
                <IconButton icon={Trash2} size={13} onClick={() => update('npc', npc.id, 'Rimuovi merce', (e) => void e.services.shop.splice(i, 1))} />
              </Row>
            ))}
            <div>
              <AddButton onClick={() => p.items[0] && update('npc', npc.id, 'Nuova merce', (e) => void e.services.shop.push({ itemId: p.items[0]!.id, price: p.items[0]!.value, stock: null, gate: emptyGate() }))}>
                Merce
              </AddButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextArea rows={2} placeholder="Locanda (camere, prezzi…)" value={npc.services.inn} onCommit={(v) => update('npc', npc.id, 'Locanda', (e) => void (e.services.inn = v))} />
              <TextArea rows={2} placeholder="Addestramento" value={npc.services.training} onCommit={(v) => update('npc', npc.id, 'Addestramento', (e) => void (e.services.training = v))} />
            </div>
          </Section>
        </>
      )}
    </>
  )
}

function ItemLeft({ item }: { item: Item }) {
  const p = useProject()
  return (
    <div className="flex flex-col gap-4">
      <Portrait imageId={item.imageId} aspect="aspect-square" onPick={(id) => update('item', item.id, 'Immagine', (e) => void (e.imageId = id))} />
      <KeyValue
        rows={[
          ['Tipo', <Combobox key="t" allowClear className="h-7" value={item.typeId} options={options(p, 'itemType')} onChange={(id) => update('item', item.id, 'Tipo', (e) => void (e.typeId = id))} />],
          ['Peso (kg)', <NumberInput key="w" min={0} className="h-7" value={item.weight} onCommit={(v) => update('item', item.id, 'Peso', (e) => void (e.weight = v ?? 0))} />],
          ['Valore', <NumberInput key="v" min={0} className="h-7" value={item.value} onCommit={(v) => update('item', item.id, 'Valore', (e) => void (e.value = v ?? 0))} />],
          ['Tag', <ListInput key="tg" value={item.tags} onCommit={(v) => update('item', item.id, 'Tag', (e) => void (e.tags = v))} />]
        ]}
      />
      <Toggle checked={item.stackable} label="Impilabile" onChange={(v) => update('item', item.id, 'Impilabile', (e) => void (e.stackable = v))} />
      <Toggle checked={item.consumable} label="Consumabile" onChange={(v) => update('item', item.id, 'Consumabile', (e) => void (e.consumable = v))} />
    </div>
  )
}

function ItemBody({ item }: { item: Item }) {
  const p = useProject()
  const sites = useMemo(() => effectSites(p).filter((s) => (s.effect.type === 'gainItem' || s.effect.type === 'loseItem') && s.effect.itemId === item.id), [p, item.id])
  let n = 0
  return (
    <>
      <Section n={++n} label="Descrizione">
        <TextArea rows={4} value={item.description} onCommit={(v) => update('item', item.id, 'Descrizione', (e) => void (e.description = v))} />
      </Section>
      <Section n={++n} label="Come si ottiene e dove si perde">
        {sites.length === 0 && <Empty>Nessuno lo dà: le condizioni che lo richiedono non saranno mai soddisfatte.</Empty>}
        {sites.map((s, i) => (
          <Row key={i}>
            <span className={cn('font-mono text-[10px] font-semibold', s.effect.type === 'gainItem' ? 'text-safe' : 'text-err')}>{s.effect.type === 'gainItem' ? 'OTTIENE' : 'PERDE'}</span>
            <EntityChip type={s.type} id={s.id} />
            <span className="text-tx3">{s.where}</span>
          </Row>
        ))}
      </Section>
      <Section n={++n} label="Campi custom">
        <CustomFields appliesTo="item" values={item.customFields} onChange={(v) => update('item', item.id, 'Campi custom', (e) => void (e.customFields = v))} />
      </Section>
    </>
  )
}

/** Step di una quest: requisiti con collegamento automatico alle fonti (decisione 4). */
function QuestSteps({ quest }: { quest: Quest }) {
  const p = useProject()
  const sites = useMemo(() => effectSites(p), [p])
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="relative flex flex-col gap-3 pl-9">
      <span className="absolute top-3 bottom-3 left-[11px] w-px bg-line2" />
      {quest.steps.map((st, i) => {
        const last = i === quest.steps.length - 1
        const ls = leaves(st.requirements)
        return (
          <div key={st.id} className="relative flex flex-col gap-2 rounded-lg border border-line2 bg-raised p-3">
            <span className={cn('absolute top-2.5 -left-9 grid size-6 place-items-center rounded-full border font-mono text-[11px] font-semibold', last ? 'border-safe text-safe' : 'border-line2 bg-panel text-tx2')}>
              {last ? <Flag size={11} /> : i + 1}
            </span>
            <div className="flex items-center gap-2">
              <TextInput className="h-7 flex-1 font-semibold" value={st.title} onCommit={(v) => update('quest', quest.id, 'Titolo step', (e) => void (e.steps[i].title = v))} />
              <IconButton icon={Trash2} size={13} title="Elimina step" onClick={() => update('quest', quest.id, 'Elimina step', (e) => void e.steps.splice(i, 1))} />
            </div>
            <TextArea rows={2} placeholder="Descrizione dello step" value={st.description} onCommit={(v) => update('quest', quest.id, 'Descrizione step', (e) => void (e.steps[i].description = v))} />
            <div className="flex items-center gap-2 text-[12px]">
              <Lock size={12} className="text-ac" />
              <span className="text-tx3">Completo quando:</span>
              <button type="button" className="min-w-0 flex-1 truncate text-left text-ac hover:underline" onClick={() => setEditing(editing === st.id ? null : st.id)}>
                {st.requirements ? describeCondition(p, st.requirements) : 'nessun requisito (solo con effetto esplicito)'}
              </button>
            </div>
            {editing === st.id && <ConditionTree value={st.requirements} onChange={(c) => update('quest', quest.id, 'Requisiti step', (e) => void (e.steps[i].requirements = c))} />}
            {ls.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md bg-sunken p-2 text-[12px]">
                <span className="font-mono text-[9.5px] font-semibold tracking-[.08em] text-tx3">FONTI COLLEGATE</span>
                {ls.map((leaf, j) => {
                  const src = sourcesOf(p, leaf, sites).filter((s) => s.type !== 'project')
                  return (
                    <div key={j} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-tx2">{describeCondition(p, leaf)} ←</span>
                      {src.length === 0 && <span className="text-warn">nessuna fonte</span>}
                      {src.slice(0, 4).map((s, k) => (
                        <EntityChip key={k} type={s.type} id={s.id} label={`${s.label} · ${s.where}`} />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div>
        <AddButton onClick={() => update('quest', quest.id, 'Nuovo step', (e) => void e.steps.push({ id: newId('step'), title: `Step ${quest.steps.length + 1}`, description: '', requirements: null }))}>Step</AddButton>
      </div>
    </div>
  )
}

function QuestBody({ quest }: { quest: Quest }) {
  const p = useProject()
  const scenes = useMemo(() => questScenes(p, quest.id), [p, quest.id])
  let n = 0
  return (
    <>
      <Section n={++n} label="Descrizione">
        <TextArea rows={3} value={quest.description} onCommit={(v) => update('quest', quest.id, 'Descrizione', (e) => void (e.description = v))} />
      </Section>
      <Section n={++n} label={`Step · ${quest.steps.length}`}>
        <QuestSteps quest={quest} />
      </Section>
      <Section n={++n} label="Ricompense">
        <KeyValue
          rows={[
            ['XP', <NumberInput key="xp" min={0} value={quest.rewards.xp} onCommit={(v) => update('quest', quest.id, 'XP', (e) => void (e.rewards.xp = v ?? 0))} />],
            ['Oggetti', <ItemQtyList key="it" items={quest.rewards.items} onChange={(v) => update('quest', quest.id, 'Ricompense', (e) => void (e.rewards.items = v))} />]
          ]}
        />
      </Section>
      <Section n={++n} label="Scene coinvolte">
        <div className="flex flex-wrap gap-1.5">
          {scenes.length === 0 && <span className="text-tx3">Nessuna scena tocca questa quest.</span>}
          {scenes.map((id) => (
            <EntityChip key={id} type="scene" id={id} />
          ))}
        </div>
      </Section>
    </>
  )
}

/** Scene che toccano una quest: effetti, condizioni o dialoghi/incontri presenti che la riguardano. */
export function questScenes(p: Project, questId: string): string[] {
  const usage = buildUsageIndex(p).get(questId) ?? []
  const out = new Set<string>()
  for (const o of usage) {
    if (o.type === 'scene') out.add(o.id)
    if (o.type === 'link') out.add(p.links.find((l) => l.id === o.id)!.fromSceneId)
    if (o.type === 'dialog') p.scenes.filter((s) => s.npcs.some((n) => n.dialogs.some((d) => d.dialogId === o.id))).forEach((s) => out.add(s.id))
    if (o.type === 'encounter') p.scenes.filter((s) => s.encounterIds.includes(o.id)).forEach((s) => out.add(s.id))
  }
  for (const st of p.quests.find((q) => q.id === questId)?.steps ?? []) {
    for (const s of p.scenes) if (stepsSatisfiedBy(p, 'scene', s.id).some((x) => x.stepId === st.id)) out.add(s.id)
  }
  return [...out]
}

/** Scheda di catalogo (3a–3e): 300px | contenuto | 320px "Usato in". */
export function CatalogSheet({ type, id }: { type: CatalogType; id: string }) {
  const p = useProject()
  const ui = useUiStore()
  const entity = (p[LIST_KEY[type]] as { id: string }[]).find((x) => x.id === id) as Npc | Enemy | Item | Quest | undefined
  const owners = useMemo(() => buildUsageIndex(p).get(id) ?? [], [p, id])
  if (!entity) return null
  const name = 'title' in entity ? entity.title : entity.name
  const close = () => ui.openSheet(null)

  const remove = async () => {
    if (owners.length) return ui.showBlocked({ name, owners })
    if (!(await confirmDialog({ title: `Eliminare «${name}»?`, confirmLabel: 'Elimina' }))) return
    close()
    apply(`Elimina ${CATEGORY[type]}`, (d) => {
      ;(d[LIST_KEY[type]] as { id: string }[]).splice((d[LIST_KEY[type]] as { id: string }[]).findIndex((x) => x.id === id), 1)
    })
  }

  const subtitle =
    type === 'npc'
      ? [(entity as Npc).role, (entity as Npc).faction].filter(Boolean).join(' · ')
      : type === 'enemy'
        ? [(entity as Enemy).creatureType, (entity as Enemy).level].filter(Boolean).join(' · ')
        : type === 'item'
          ? p.settings.itemTypes.find((t) => t.id === (entity as Item).typeId)?.name
          : `${(entity as Quest).steps.length} step`

  const highlightScenes = () => {
    const ids =
      type === 'quest'
        ? questScenes(p, id)
        : owners.flatMap((o) => (o.type === 'scene' ? [o.id] : o.type === 'link' ? [p.links.find((l) => l.id === o.id)!.fromSceneId] : o.type === 'encounter' ? p.scenes.filter((s) => s.encounterIds.includes(o.id)).map((s) => s.id) : []))
    ui.setHighlight({ sceneIds: new Set(ids), label: `${ids.length} scene con «${name}»` })
    close()
  }

  const left = type === 'npc' || type === 'enemy' ? <CreatureLeft c={entity as Creature} type={type} /> : type === 'item' ? <ItemLeft item={entity as Item} /> : null
  const body =
    type === 'npc' || type === 'enemy' ? <CreatureBody c={entity as Creature} type={type} /> : type === 'item' ? <ItemBody item={entity as Item} /> : <QuestBody quest={entity as Quest} />

  return (
    <Sheet
      category="Catalogo"
      chips={<span className="rounded-[4px] border border-line2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[.06em] text-tx2">{CATEGORY[type].toUpperCase()}</span>}
      title={
        <TextInput
          className="h-auto w-full border-transparent bg-transparent px-0 text-[22px] font-semibold tracking-[-.01em] focus:border-transparent focus:shadow-none"
          value={name}
          onCommit={(v) => v.trim() && update(type, id, 'Rinomina', (e) => void ('title' in e ? (e.title = v.trim()) : (e.name = v.trim())))}
        />
      }
      subtitle={subtitle}
      actions={
        <>
          <IconButton icon={Highlighter} size={14} title="Evidenzia nel grafo" onClick={highlightScenes} />
          <IconButton icon={Trash2} size={14} title="Elimina" onClick={remove} />
        </>
      }
      width={1480}
      height={880}
      onClose={close}
      bodyClassName="flex"
      footer={<span>Le modifiche si salvano da sole · Ctrl+Z annulla</span>}
    >
      {left && <div className="w-[360px] flex-none overflow-x-hidden overflow-y-auto border-r border-line p-5">{left}</div>}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5" data-text-scale>
        {body}
      </div>
      <aside className="flex w-[320px] flex-none flex-col gap-3 overflow-y-auto border-l border-line bg-sunken p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">USATO IN</span>
          <span className="font-mono text-[10.5px] text-tx3">{owners.length} riferimenti</span>
        </div>
        <UsageList owners={owners} limit={12} />
        {(type === 'item' || type === 'quest') && (
          <button type="button" className="self-start text-[12px] text-ac hover:underline" onClick={() => ui.openSheet({ kind: 'cross', tab: type, entityId: id })}>
            Vista incrociata completa →
          </button>
        )}
      </aside>
    </Sheet>
  )
}

export function NewEntityButton({ type }: { type: CatalogType }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-tx2 hover:text-tx"
      onClick={() => {
        const id = createEntity(type, `Nuovo ${CATEGORY[type]}`)
        if (id) openEntity(type, id)
      }}
    >
      <Plus size={13} />
    </button>
  )
}
