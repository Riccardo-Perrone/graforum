import { useMemo } from 'react'
import { CircleAlert, Moon, OctagonX, Sun } from 'lucide-react'
import { validate } from '@shared/engine'
import { useProjectStore } from '../../store/project'
import { effectiveTheme, useUiStore } from '../../store/ui'

export function StatusBar() {
  const project = useProjectStore((s) => s.project)
  const savedAt = useProjectStore((s) => s.savedAt)
  const filePath = useProjectStore((s) => s.filePath)
  const { zoom, selectedSceneIds } = useUiStore()
  const theme = effectiveTheme(useUiStore((s) => s.theme))
  const issues = useMemo(() => (project ? validate(project) : []), [project])
  if (!project) return null
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length

  const selected =
    selectedSceneIds.length === 1
      ? project.scenes.find((s) => s.id === selectedSceneIds[0])?.title
      : selectedSceneIds.length > 1
        ? `${selectedSceneIds.length} scene`
        : 'nessuna'

  return (
    <footer className="flex h-[26px] flex-none items-center gap-[18px] border-t border-line bg-panel px-3 font-mono text-[11px] font-medium text-tx3">
      <span>
        {project.scenes.length} scene · {project.groups.length} gruppi · {project.endings.length} finali
      </span>
      <span className="flex items-center gap-2.5">
        <span className="flex items-center gap-1 text-err">
          <OctagonX size={11} />{errors} {errors === 1 ? 'errore' : 'errori'}
        </span>
        <span className="flex items-center gap-1 text-warn">
          <CircleAlert size={11} />{warnings} {warnings === 1 ? 'avviso' : 'avvisi'}
        </span>
      </span>
      <span>Selezione: {selected}</span>
      <div className="flex-1" />
      <span>
        {filePath
          ? `Salvataggio automatico${savedAt ? ` · ${savedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}`
          : 'Non ancora salvato · Ctrl+S'}
      </span>
      <span>Zoom {Math.round(zoom * 100)}%</span>
      <span className="flex items-center gap-[5px]">
        {theme === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
        {theme === 'dark' ? 'Tema scuro' : 'Tema chiaro'}
      </span>
    </footer>
  )
}
