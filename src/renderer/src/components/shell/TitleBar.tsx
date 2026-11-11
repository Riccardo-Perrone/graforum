import { LayoutDashboard, Moon, Redo2, Sun, Undo2 } from 'lucide-react'
import { isDirty, useProjectStore } from '../../store/project'
import { effectiveTheme, useUiStore } from '../../store/ui'
import { dockBridge } from '../../dock/bridge'
import { useKbd } from '../../lib/commands'
import { IconButton } from '../ui/primitives'
import { MenuBar } from './MenuBar'

/** Larghezza dei tre controlli finestra nativi (46px ciascuno) disegnati da Windows. */
const WINDOW_CONTROLS_WIDTH = 138

const time = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

export function TitleBar() {
  const project = useProjectStore((s) => s.project)
  const filePath = useProjectStore((s) => s.filePath)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  const dirty = useProjectStore(isDirty)
  const savedAt = useProjectStore((s) => s.savedAt)
  const { undo, redo } = useProjectStore.getState()
  const theme = effectiveTheme(useUiStore((s) => s.theme))
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const fileName = filePath?.split(/[\\/]/).pop()
  const kbdLayout = useKbd('resetLayout')
  const kbdUndo = useKbd('undo')
  const kbdRedo = useKbd('redo')
  const kbdTheme = useKbd('toggleTheme')
  const withKbd = (label: string, kbd: string) => (kbd ? `${label} (${kbd})` : label)

  return (
    <header
      className="drag flex h-9 flex-none items-center gap-3.5 border-b border-line bg-panel pl-3"
      style={{ paddingRight: WINDOW_CONTROLS_WIDTH }}
    >
      <div className="size-4 scale-[.78] rotate-45 rounded bg-ac" />
      <MenuBar />
      {project && (
        <div className="no-drag flex gap-0.5">
          <IconButton icon={Undo2} title={withKbd('Annulla', kbdUndo)} disabled={!canUndo} onClick={undo} />
          <IconButton icon={Redo2} title={withKbd('Ripeti', kbdRedo)} disabled={!canRedo} onClick={redo} />
        </div>
      )}
      <div className="flex flex-1 items-center justify-center gap-2 text-[12.5px]">
        {project && (
          <>
            <span className="text-tx">{project.name}</span>
            <span className="font-mono text-[11px] text-tx3">{fileName ?? 'non salvato'}</span>
          </>
        )}
      </div>
      {project && (
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-tx3">
          <span className={`size-1.5 rounded-full ${dirty ? 'bg-warn' : 'bg-safe'}`} />
          {dirty ? 'Modifiche non salvate' : savedAt ? `Salvato ${time(savedAt)}` : 'Salvato'}
        </div>
      )}
      {project && (
        <IconButton
          className="no-drag"
          icon={LayoutDashboard}
          title={withKbd('Layout standard', kbdLayout)}
          onClick={() => dockBridge.resetLayout?.()}
        />
      )}
      <IconButton
        className="no-drag"
        icon={theme === 'dark' ? Moon : Sun}
        title={withKbd('Cambia tema', kbdTheme)}
        onClick={toggleTheme}
      />
    </header>
  )
}
