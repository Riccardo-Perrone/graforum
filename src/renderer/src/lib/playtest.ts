import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'

// Avvio del playtest: le stesse regole per pulsanti, menu e scorciatoie.

/** Il playtest dall'inizio richiede una scena di partenza (come il pulsante Playtest della barra del grafo). */
export const canPlayFromStart = (): boolean => !!useProjectStore.getState().project?.startSceneId

/** Apre il playtest dalla scena di partenza; non fa nulla se il progetto non ne ha una. */
export function playFromStart(): void {
  if (canPlayFromStart()) useUiStore.getState().setView({ kind: 'playtest', startSceneId: null })
}

/** Apre il playtest dalla scena indicata o, senza argomento, dalla prima scena selezionata. */
export function playFromScene(sceneId?: string): void {
  const id = sceneId ?? useUiStore.getState().selectedSceneIds[0]
  if (id) useUiStore.getState().setView({ kind: 'playtest', startSceneId: id })
}
