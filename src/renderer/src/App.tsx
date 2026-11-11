import { useEffect } from 'react'
import { StatusBar } from './components/shell/StatusBar'
import { TitleBar } from './components/shell/TitleBar'
import { newProject, openProject, saveProject } from './lib/fileActions'
import { playFromScene, playFromStart } from './lib/playtest'
import { useCommand } from './lib/shortcuts'
import { ConfirmHost } from './components/ui/ConfirmDialog'
import { dockBridge } from './dock/bridge'
import { DockHost } from './dock/DockHost'
import { SheetHost } from './screens/SheetHost'
import { Home } from './screens/Home'
import { isDirty, useProjectStore } from './store/project'
import { startUpdates } from './store/updates'
import { effectiveTheme, useUiStore } from './store/ui'

const AUTOSAVE_DELAY_MS = 2000
const UPDATE_CHECK_DELAY_MS = 4000

export function App() {
  const hasProject = useProjectStore((s) => s.project !== null)
  const themePref = useUiStore((s) => s.theme)
  const uiScale = useUiStore((s) => s.uiScale)
  const textScale = useUiStore((s) => s.textScale)
  const { undo, redo } = useProjectStore.getState()

  useEffect(() => {
    const applyTheme = () => {
      const theme = effectiveTheme(themePref)
      document.documentElement.dataset.theme = theme
      window.graforum.setTheme(theme)
    }
    applyTheme()
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', applyTheme)
    return () => mq.removeEventListener('change', applyTheme)
  }, [themePref])

  // Scala dell'interfaccia (tutta la finestra) e dimensione del testo di pannelli e schede.
  useEffect(() => window.graforum.setZoom(uiScale), [uiScale])
  useEffect(() => document.documentElement.style.setProperty('--text-scale', String(textScale)), [textScale])

  // Aggiornamenti: si legge lo stato e, se l'utente non l'ha escluso, si cerca una nuova versione poco dopo l'avvio.
  useEffect(() => {
    startUpdates()
    if (!useUiStore.getState().autoCheckUpdates) return
    const timer = setTimeout(() => void window.graforum.checkForUpdates(), UPDATE_CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Autosalvataggio: solo se il progetto ha già un file.
  const revision = useProjectStore((s) => s.revision)
  const canAutosave = useProjectStore((s) => s.filePath !== null && isDirty(s))
  useEffect(() => {
    if (!canAutosave) return
    const timer = setTimeout(() => void saveProject(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [revision, canAutosave])

  useCommand('undo', undo)
  useCommand('redo', redo)
  useCommand('redoAlt', redo)
  useCommand('save', () => void saveProject())
  useCommand('saveAs', () => void saveProject(true))
  useCommand('openProject', () => void openProject())
  useCommand('newProject', newProject)
  useCommand('toggleTheme', useUiStore.getState().toggleTheme)
  useCommand('documents', () => hasProject && dockBridge.openPanel?.('documents'))
  useCommand('dialogList', () => hasProject && dockBridge.openPanel?.('dialogs'))
  // Comandi globali che non devono dipendere dalla scheda del grafo (che si può chiudere).
  useCommand('playFromStart', () => hasProject && playFromStart())
  useCommand('playFromHere', () => hasProject && playFromScene())
  useCommand('toggleValidation', () => hasProject && dockBridge.togglePanel?.('validation'))
  useCommand('crossProgress', () => hasProject && useUiStore.getState().openSheet({ kind: 'cross', tab: 'progress' }))

  return (
    <div className="flex h-full flex-col bg-bg text-tx">
      <TitleBar />
      {!hasProject ? (
        <Home />
      ) : (
        <DockHost />
      )}
      {hasProject && <SheetHost />}
      <ConfirmHost />
      <StatusBar />
    </div>
  )
}
