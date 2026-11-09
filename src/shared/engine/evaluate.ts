import { produce } from 'immer'
import type { Condition, Effect, EncounterOutcome, Gate, QuestState } from '../model/logic'
import type { Preset, Project } from '../model/project'

// Stato del playtest e valutazione di condizioni/effetti (§5 dei requisiti, §3 del modello v3).

export interface PlayState {
  sceneId: string | null
  inventory: Record<string, number>
  questStates: Record<string, QuestState>
  stepStates: Record<string, QuestState>
  flags: Record<string, boolean>
  completedDialogs: string[]
  choices: string[]
  talkedTo: string[]
  encounters: Record<string, EncounterOutcome>
  passedChecks: string[]
  visited: string[]
  unlocked: string[]
  locked: string[]
  /** Esito scelto a mano per le condizioni personalizzate (chiave = JSON della condizione). */
  manual: Record<string, boolean>
  history: { sceneId: string; note: string }[]
}

export function initialPlayState(p: Project, preset?: Preset | null): PlayState {
  const s: PlayState = {
    sceneId: p.startSceneId,
    inventory: {},
    questStates: {},
    stepStates: {},
    flags: Object.fromEntries(p.flags.map((f) => [f.id, f.defaultValue])),
    completedDialogs: [],
    choices: [],
    talkedTo: [],
    encounters: {},
    passedChecks: [],
    visited: [],
    unlocked: [],
    locked: [],
    manual: {},
    history: []
  }
  if (preset) {
    for (const i of preset.items) s.inventory[i.itemId] = i.quantity
    for (const q of preset.quests) {
      if (q.stepId) s.stepStates[q.stepId] = q.state
      else s.questStates[q.questId] = q.state
    }
    for (const f of preset.flags) s.flags[f.flagId] = f.value
  }
  return s
}

export const manualKey = (c: Condition) => JSON.stringify(c)

export function questState(s: PlayState, questId: string): QuestState {
  return s.questStates[questId] ?? 'notStarted'
}

export function evalCondition(p: Project, s: PlayState, c: Condition | null): boolean {
  if (!c) return true
  switch (c.type) {
    case 'group':
      return c.op === 'and' ? c.children.every((x) => evalCondition(p, s, x)) : c.children.length === 0 || c.children.some((x) => evalCondition(p, s, x))
    case 'hasItem':
      return (s.inventory[c.itemId] ?? 0) >= c.quantity
    case 'questState':
      return (c.stepId ? (s.stepStates[c.stepId] ?? 'notStarted') : questState(s, c.questId)) === c.state
    case 'dialogCompleted':
      return s.completedDialogs.includes(c.dialogId)
    case 'dialogChoice':
      return s.choices.includes(c.choiceId)
    case 'talkedTo':
      return s.talkedTo.includes(c.npcId)
    case 'encounterOutcome':
      return c.outcome === 'any' ? c.encounterId in s.encounters : s.encounters[c.encounterId] === c.outcome
    case 'flag':
      return (s.flags[c.flagId] ?? false) === c.value
    case 'checkPassed':
      return c.checkIds.some((id) => s.passedChecks.includes(id))
    case 'sceneVisited':
      return s.visited.includes(c.sceneId)
    case 'customType':
    case 'freeText':
      return s.manual[manualKey(c)] ?? false
  }
}

export type GateStatus = 'open' | 'hidden' | 'locked'

/** Un'entità sbloccata/bloccata da un effetto ignora la propria condizione. */
export function gateStatus(p: Project, s: PlayState, gate: Gate, targetId?: string): GateStatus {
  if (targetId && s.locked.includes(targetId)) return 'locked'
  if (targetId && s.unlocked.includes(targetId)) return 'open'
  if (evalCondition(p, s, gate.condition)) return 'open'
  return gate.whenUnmet
}

function setStep(p: Project, s: PlayState, questId: string, stepId: string, state: QuestState) {
  s.stepStates[stepId] = state
  if (state !== 'notStarted' && questState(s, questId) === 'notStarted') s.questStates[questId] = 'inProgress'
  const quest = p.quests.find((q) => q.id === questId)
  const last = quest?.steps.at(-1)
  if (last && last.id === stepId && state === 'completed') s.questStates[questId] = 'completed'
}

function applyOne(p: Project, s: PlayState, e: Effect) {
  switch (e.type) {
    case 'gainItem':
      s.inventory[e.itemId] = (s.inventory[e.itemId] ?? 0) + e.quantity
      break
    case 'loseItem': {
      const left = (s.inventory[e.itemId] ?? 0) - e.quantity
      if (left > 0) s.inventory[e.itemId] = left
      else delete s.inventory[e.itemId]
      break
    }
    case 'questStart':
      if (questState(s, e.questId) === 'notStarted') s.questStates[e.questId] = 'inProgress'
      break
    case 'questAdvance': {
      const quest = p.quests.find((q) => q.id === e.questId)
      if (!quest) break
      if (questState(s, e.questId) === 'notStarted') s.questStates[e.questId] = 'inProgress'
      if (e.stepId) {
        // Avanzare a uno step: i precedenti sono completati, quello indicato è in corso.
        const idx = quest.steps.findIndex((x) => x.id === e.stepId)
        quest.steps.slice(0, idx).forEach((x) => setStep(p, s, quest.id, x.id, 'completed'))
        if ((s.stepStates[e.stepId] ?? 'notStarted') === 'notStarted') s.stepStates[e.stepId] = 'inProgress'
      } else {
        const next = quest.steps.find((x) => (s.stepStates[x.id] ?? 'notStarted') !== 'completed')
        if (next) setStep(p, s, quest.id, next.id, 'completed')
      }
      break
    }
    case 'questComplete':
      if (e.stepId) setStep(p, s, e.questId, e.stepId, 'completed')
      else {
        s.questStates[e.questId] = 'completed'
        p.quests.find((q) => q.id === e.questId)?.steps.forEach((x) => (s.stepStates[x.id] = 'completed'))
      }
      break
    case 'unlock':
      s.locked = s.locked.filter((id) => id !== e.target.id)
      if (!s.unlocked.includes(e.target.id)) s.unlocked.push(e.target.id)
      break
    case 'lock':
      s.unlocked = s.unlocked.filter((id) => id !== e.target.id)
      if (!s.locked.includes(e.target.id)) s.locked.push(e.target.id)
      break
    case 'setFlag':
      s.flags[e.flagId] = e.value
      break
    case 'freeText':
      break
  }
}

/** Completa da sé gli step i cui requisiti sono soddisfatti (decisione 4). */
function autoAdvance(p: Project, s: PlayState) {
  for (let round = 0; round < 10; round++) {
    let changed = false
    for (const quest of p.quests) {
      for (const step of quest.steps) {
        if (!step.requirements || (s.stepStates[step.id] ?? 'notStarted') === 'completed') continue
        if (evalCondition(p, s, step.requirements)) {
          setStep(p, s, quest.id, step.id, 'completed')
          changed = true
        }
      }
    }
    if (!changed) return
  }
}

export function applyEffects(p: Project, state: PlayState, effects: Effect[]): PlayState {
  return produce(state, (s) => {
    for (const e of effects) applyOne(p, s as PlayState, e)
    autoAdvance(p, s as PlayState)
  })
}

/** Modifica libera dello stato seguita dall'avanzamento automatico delle quest. */
export function updateState(p: Project, state: PlayState, recipe: (s: PlayState) => void): PlayState {
  return produce(state, (s) => {
    recipe(s as PlayState)
    autoAdvance(p, s as PlayState)
  })
}
