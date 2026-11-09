import { useCallback, useRef, type FunctionComponent, type ReactNode } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { CatalogPanel } from '../components/catalog/CatalogPanel'
import { GraphCanvas } from '../components/graph/GraphCanvas'
import { SCENE_NODE_WIDTH } from '../components/graph/SceneNode'
import { DockedGroupPanel } from '../components/scene/GroupSheet'
import { DockedScenePanel } from '../components/scene/SceneSheet'
import { Toolbar } from '../components/shell/Toolbar'
import { ValidationPanel } from '../components/validation/ValidationPanel'
import { createScene, groupSelection, removeFromGroup } from '../lib/sceneOps'
import { useCommand } from '../lib/shortcuts'
import { DialogEditor } from '../screens/DialogEditor'
import { DialogsListView } from '../screens/DialogsListView'
import { DocumentsView } from '../screens/DocumentsView'
import { PlaytestView } from '../screens/PlaytestView'
import { useUiStore } from '../store/ui'
import type { PanelId } from './bridge'

type P = IDockviewPanelProps<Record<string, unknown>>

/** Ogni scheda riempie lo spazio che il dock le assegna; le schermate con `flex-1` hanno così un genitore flex. */
const Frame = ({ children }: { children: ReactNode }) => <div className="flex h-full min-h-0 w-full flex-col bg-bg text-tx">{children}</div>

function GraphBody() {
  const flow = useReactFlow()
  const body = useRef<HTMLDivElement>(null)
  const { highlight, setHighlight, selectedSceneIds } = useUiStore()

  /** Crea una scena al centro della vista. */
  const newScene = useCallback(() => {
    // Si cerca nella scheda stessa, non nel documento: il grafo può stare in una finestra staccata.
    const canvas = body.current?.querySelector('.react-flow')?.getBoundingClientRect()
    const center = canvas ? flow.screenToFlowPosition({ x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 }) : { x: 0, y: 0 }
    createScene({ x: center.x - SCENE_NODE_WIDTH / 2, y: center.y - 68 })
  }, [flow])

  useCommand('newScene', newScene)
  useCommand('groupSelection', () => selectedSceneIds.length && groupSelection())
  useCommand('removeFromGroup', () => selectedSceneIds.length && removeFromGroup(selectedSceneIds))
  useCommand('toggleSnap', () => useUiStore.getState().setPrefs({ snap: !useUiStore.getState().snap }))
  useCommand('fitView', () => void flow.fitView({ padding: 0.15, duration: 200 }))
  useCommand('clearHighlight', () => highlight && setHighlight(null))

  return (
    <>
      <Toolbar onNewScene={newScene} />
      <div ref={body} className="relative min-h-0 flex-1">
        <GraphCanvas />
      </div>
    </>
  )
}

function GraphPanel() {
  return (
    <Frame>
      <ReactFlowProvider>
        <GraphBody />
      </ReactFlowProvider>
    </Frame>
  )
}

/** Scheda unica per scena e gruppo: mostra il gruppo se è l'unica cosa selezionata, altrimenti la scena. */
function InspectorPanel() {
  const selectedSceneIds = useUiStore((s) => s.selectedSceneIds)
  const selectedGroupId = useUiStore((s) => s.selectedGroupId)
  return <Frame>{selectedSceneIds.length === 0 && selectedGroupId ? <DockedGroupPanel id={selectedGroupId} /> : <DockedScenePanel />}</Frame>
}

const wrap = (render: (p: P) => ReactNode) =>
  function Panel(props: P) {
    return <Frame>{render(props)}</Frame>
  }

/** Componenti delle schede, per id. */
export const PANEL_COMPONENTS: Record<PanelId, FunctionComponent<P>> = {
  graph: GraphPanel,
  inspector: InspectorPanel,
  catalog: wrap(() => <CatalogPanel />),
  validation: wrap(() => <ValidationPanel />),
  // `nonce` cambia a ogni richiesta di playtest: la scheda riparte dalla scena indicata.
  playtest: wrap((p) => <PlaytestView key={String(p.params.nonce)} startSceneId={(p.params.startSceneId as string | null) ?? null} />),
  // Elenco e editor dei dialoghi stanno nella stessa scheda: `dialogId` apre il dialogo, senza `dialogId` si vede l'elenco.
  dialogs: wrap((p) => (p.params.dialogId ? <DialogEditor dialogId={String(p.params.dialogId)} /> : <DialogsListView />)),
  documents: wrap((p) => <DocumentsView docId={(p.params.docId as string | null) ?? null} />)
}
