import { create } from 'zustand'
import type { UpdateStatus } from '@shared/ipc'

// Stato dell'aggiornamento automatico: lo decide il processo principale, qui lo si rispecchia.

interface UpdatesState {
  status: UpdateStatus | null
}

export const useUpdatesStore = create<UpdatesState>(() => ({ status: null }))

let started = false

/** Da chiamare una volta all'avvio: legge lo stato e ascolta i cambi. */
export function startUpdates(): void {
  if (started) return
  started = true
  window.graforum.onUpdateStatus((status) => useUpdatesStore.setState({ status }))
  void window.graforum.getUpdateStatus().then((status) => useUpdatesStore.setState((s) => (s.status ? s : { status })))
}
