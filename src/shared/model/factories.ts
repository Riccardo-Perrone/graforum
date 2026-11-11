import { newId } from './ids'
import { DialogChoice, DialogLine } from './catalog'
import { ENDING_COLORS, Encounter, Ending, Group, Link, Scene } from './graph'

// Entità nuove con i valori predefiniti dello schema: un solo posto dove si decide com'è fatta un'entità vuota.
// Restituiscono oggetti già validi; chi li usa li aggiunge al progetto dentro `apply(...)`.

/** Scena vuota nella posizione indicata (arrotondata ai pixel interi). */
export function makeScene(position: { x: number; y: number }, init: { title?: string; groupId?: string | null } = {}): Scene {
  return Scene.parse({
    id: newId('scene'),
    title: init.title ?? 'Nuova scena',
    groupId: init.groupId ?? null,
    position: { x: Math.round(position.x), y: Math.round(position.y) }
  })
}

/** Gruppo vuoto, dentro `parentId` (null = al primo livello). */
export function makeGroup(name: string, parentId: string | null = null): Group {
  return Group.parse({ id: newId('group'), name, parentId })
}

/** Collegamento semplice da una scena a un'altra, senza condizioni. */
export function makeLink(fromSceneId: string, toSceneId: string): Link {
  return Link.parse({ id: newId('link'), fromSceneId, toSceneId })
}

/** Incontro con esiti vuoti; `enemyIds` aggiunge un enemy (quantità 1) per voce. */
export function makeEncounter(name: string, enemyIds: string[] = []): Encounter {
  return Encounter.parse({ id: newId('encounter'), name, enemies: enemyIds.map((enemyId) => ({ enemyId, quantity: 1 })) })
}

/** Finale sulla scena indicata; il colore segue la tavolozza a rotazione in base a quanti finali esistono già. */
export function makeEnding(sceneId: string, existing: number): Ending {
  return Ending.parse({ id: newId('ending'), sceneId, label: 'Nuovo finale', color: ENDING_COLORS[existing % ENDING_COLORS.length] })
}

/** Battuta vuota detta dall'NPC del dialogo. */
export function makeDialogLine(position: { x: number; y: number }): DialogLine {
  return DialogLine.parse({ id: newId('dialogLine'), position })
}

/** Scelta vuota; `targetLineId` null = chiude il dialogo. */
export function makeDialogChoice(targetLineId: string | null = null): DialogChoice {
  return DialogChoice.parse({ id: newId('dialogChoice'), text: '', targetLineId })
}
