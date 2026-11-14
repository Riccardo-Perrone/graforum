import { create } from 'zustand'
import { soundUrl } from '@shared/ipc'
import { useUiStore } from './ui'

// Player dei suoni: un solo elemento audio per tutta l'app, quindi un solo suono alla volta
// (libreria e scene condividono lo stesso stato). Il volume sta nelle preferenze dell'app.

interface PlayerState {
  soundId: string | null
  playing: boolean
  /** Posizione e durata in secondi. */
  time: number
  duration: number
  loop: boolean
  /** Il file non si è potuto leggere. */
  failed: boolean

  /** Avvia il suono indicato dall'inizio (o riprende se è già quello attivo). Senza id: riprende/mette in pausa l'attuale. */
  toggle(id?: string): void
  pause(): void
  stop(): void
  seek(seconds: number): void
  setVolume(volume: number): void
  setLoop(loop: boolean): void
}

let audio: HTMLAudioElement | null = null

function element(): HTMLAudioElement {
  if (audio) return audio
  const a = new Audio()
  a.preload = 'metadata'
  a.volume = useUiStore.getState().volume
  a.addEventListener('timeupdate', () => usePlayer.setState({ time: a.currentTime }))
  a.addEventListener('loadedmetadata', () => usePlayer.setState({ duration: Number.isFinite(a.duration) ? a.duration : 0 }))
  a.addEventListener('durationchange', () => usePlayer.setState({ duration: Number.isFinite(a.duration) ? a.duration : 0 }))
  a.addEventListener('play', () => usePlayer.setState({ playing: true, failed: false }))
  a.addEventListener('pause', () => usePlayer.setState({ playing: false }))
  a.addEventListener('ended', () => usePlayer.setState({ playing: false, time: 0 }))
  a.addEventListener('error', () => usePlayer.setState({ playing: false, failed: true }))
  audio = a
  return a
}

export const usePlayer = create<PlayerState>((set, get) => ({
  soundId: null,
  playing: false,
  time: 0,
  duration: 0,
  loop: false,
  failed: false,

  toggle: (id) => {
    const a = element()
    const target = id ?? get().soundId
    if (!target) return
    if (target !== get().soundId) {
      a.src = soundUrl(target)
      a.loop = get().loop
      set({ soundId: target, time: 0, duration: 0, failed: false })
    }
    if (a.paused) void a.play().catch(() => set({ playing: false, failed: true }))
    else a.pause()
  },
  pause: () => audio?.pause(),
  stop: () => {
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    set({ soundId: null, playing: false, time: 0, duration: 0, failed: false })
  },
  seek: (seconds) => {
    const a = element()
    a.currentTime = Math.max(0, seconds)
    set({ time: a.currentTime })
  },
  setVolume: (volume) => {
    const v = Math.min(1, Math.max(0, volume))
    element().volume = v
    useUiStore.getState().setPrefs({ volume: v })
  },
  setLoop: (loop) => {
    element().loop = loop
    set({ loop })
  }
}))
