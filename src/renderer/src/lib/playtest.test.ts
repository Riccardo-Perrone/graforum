import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProject } from '@shared/sample/locanda-del-corvo'
import { dockBridge } from '../dock/bridge'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { canPlayFromStart, playFromScene, playFromStart } from './playtest'

// Pulsante Playtest, menu Progetto e scorciatoie seguono le stesse regole.

describe('avvio del playtest', () => {
  const openPanel = vi.fn()
  beforeEach(() => {
    openPanel.mockClear()
    dockBridge.openPanel = openPanel
    useProjectStore.getState().load(sampleProject(), null)
    useUiStore.getState().setSelection([])
  })
  afterEach(() => void delete dockBridge.openPanel)

  it('dall’inizio parte se il progetto ha una scena di partenza', () => {
    expect(canPlayFromStart()).toBe(true)
    playFromStart()
    expect(openPanel).toHaveBeenCalledWith('playtest', expect.objectContaining({ startSceneId: null }))
  })

  it('senza scena di partenza non fa nulla, come il pulsante disattivato', () => {
    useProjectStore.getState().apply('Togli partenza', (d) => void (d.startSceneId = null))
    expect(canPlayFromStart()).toBe(false)
    playFromStart()
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('dalla scena selezionata, o da quella indicata; senza selezione non fa nulla', () => {
    playFromScene()
    expect(openPanel).not.toHaveBeenCalled()
    useUiStore.getState().setSelection(['scn_sala'])
    playFromScene()
    expect(openPanel).toHaveBeenLastCalledWith('playtest', expect.objectContaining({ startSceneId: 'scn_sala' }))
    playFromScene('scn_cantina')
    expect(openPanel).toHaveBeenLastCalledWith('playtest', expect.objectContaining({ startSceneId: 'scn_cantina' }))
  })
})
