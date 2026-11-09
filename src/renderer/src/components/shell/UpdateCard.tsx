import { CircleAlert, CircleCheck, Download, RefreshCw, RotateCw } from 'lucide-react'
import type { UpdateStatus } from '@shared/ipc'
import { isDirty, useProjectStore } from '../../store/project'
import { useUpdatesStore } from '../../store/updates'
import { confirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../ui/primitives'

// Ricerca e installazione degli aggiornamenti: usata nella Home e nelle Impostazioni.

async function install(): Promise<void> {
  // L'installazione chiude l'app: con modifiche non salvate si chiede prima.
  const unsaved = isDirty(useProjectStore.getState()) && useProjectStore.getState().project !== null
  if (unsaved && !(await confirmDialog({ title: 'Ci sono modifiche non salvate', detail: 'Riavviando per aggiornare andranno perse. Salva il progetto e riprova, oppure continua.', confirmLabel: 'Riavvia comunque', danger: true }))) return
  window.graforum.installUpdate()
}

function Line({ status }: { status: UpdateStatus }) {
  const common = 'flex items-start gap-1.5 text-[12px]'
  switch (status.state) {
    case 'unsupported':
      return <span className="text-[12px] text-tx3">Gli aggiornamenti funzionano solo nell’app installata, non in modalità sviluppo.</span>
    case 'checking':
      return <span className="text-[12px] text-tx3">Ricerca in corso…</span>
    case 'none':
      return (
        <span className={cn(common, 'text-tx2')}>
          <CircleCheck size={14} className="mt-px flex-none text-safe" />
          Hai già l’ultima versione.
        </span>
      )
    case 'available':
      return <span className="text-[12px] text-tx">È disponibile la versione <b>{status.newVersion}</b>.</span>
    case 'downloading':
      return <span className="text-[12px] text-tx3">Download della versione {status.newVersion}… {status.percent ?? 0}%</span>
    case 'ready':
      return <span className="text-[12px] text-tx">La versione <b>{status.newVersion}</b> è pronta: riavvia per installarla.</span>
    case 'error':
      return (
        <span className={cn(common, 'text-err')}>
          <CircleAlert size={14} className="mt-px flex-none" />
          {status.error}
        </span>
      )
    default:
      return <span className="text-[12px] text-tx3">Non hai ancora cercato aggiornamenti.</span>
  }
}

const btn = 'flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[12.5px] font-medium disabled:opacity-50'

/** Scheda «Aggiornamenti»: versione installata, stato, e il pulsante giusto per il passo in corso. */
export function UpdateCard({ className }: { className?: string }) {
  const status = useUpdatesStore((s) => s.status)
  if (!status) return null
  const busy = status.state === 'checking' || status.state === 'downloading'

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-line2 bg-raised p-3', className)} data-update-state={status.state}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[.1em] text-tx3">AGGIORNAMENTI</span>
        <span className="ml-auto font-mono text-[10.5px] text-tx3">v{status.currentVersion}</span>
      </div>
      <Line status={status} />
      {status.state === 'available' && status.notes && <p className="m-0 max-h-24 overflow-y-auto text-[11.5px] whitespace-pre-line text-tx3">{status.notes}</p>}
      {status.state === 'downloading' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full bg-ac transition-[width]" style={{ width: `${status.percent ?? 0}%` }} />
        </div>
      )}
      {status.state === 'available' && (
        <button type="button" className={cn(btn, 'bg-btn text-btntx hover:opacity-90')} onClick={() => void window.graforum.downloadUpdate()}>
          <Download size={14} />
          Scarica e aggiorna
        </button>
      )}
      {status.state === 'ready' && (
        <button type="button" className={cn(btn, 'bg-btn text-btntx hover:opacity-90')} onClick={() => void install()}>
          <RotateCw size={14} />
          Riavvia e installa
        </button>
      )}
      {status.state !== 'available' && status.state !== 'ready' && status.state !== 'unsupported' && (
        <button type="button" disabled={busy} className={cn(btn, 'border border-line2 text-tx hover:bg-hover')} onClick={() => void window.graforum.checkForUpdates()}>
          <RefreshCw size={14} className={cn(status.state === 'checking' && 'animate-spin')} />
          Cerca aggiornamenti
        </button>
      )}
    </div>
  )
}
