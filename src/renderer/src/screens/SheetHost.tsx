import { CrossViews } from '../components/cross/CrossViews'
import { ExportSheet } from '../components/export/ExportSheet'
import { CatalogSheet } from '../components/catalog/CatalogSheet'
import { ImagePicker } from '../components/images/ImagePicker'
import { BlockedDeleteDialog } from '../components/logic/UsageList'
import { GroupSheet } from '../components/scene/GroupSheet'
import { SceneSheet } from '../components/scene/SceneSheet'
import { SettingsSheet } from '../components/settings/SettingsSheet'
import { useUiStore } from '../store/ui'

/** Finestre aperte sopra il grafo, una alla volta (più le finestre di conferma). */
export function SheetHost() {
  const sheet = useUiStore((s) => s.sheet)
  const blocked = useUiStore((s) => s.blocked)
  const close = () => useUiStore.getState().openSheet(null)
  return (
    <>
      {sheet?.kind === 'scene' && <SceneSheet id={sheet.id} />}
      {sheet?.kind === 'catalog' && <CatalogSheet type={sheet.type} id={sheet.id} />}
      {sheet?.kind === 'settings' && <SettingsSheet page={sheet.page} />}
      {sheet?.kind === 'group' && <GroupSheet id={sheet.id} />}
      {sheet?.kind === 'cross' && <CrossViews key={`${sheet.tab}-${sheet.entityId ?? ''}`} tab={sheet.tab} entityId={sheet.entityId} scopeSceneId={sheet.scopeSceneId} onlyPath={sheet.onlyPath} />}
      {sheet?.kind === 'export' && <ExportSheet />}
      {sheet?.kind === 'images' && <ImagePicker onClose={close} />}
      {blocked && <BlockedDeleteDialog name={blocked.name} owners={blocked.owners} onClose={() => useUiStore.getState().showBlocked(null)} />}
    </>
  )
}
