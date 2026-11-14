import { Pause, Play, Repeat, Square, Volume2, VolumeX } from 'lucide-react'
import { apply, useProject } from '../../lib/entities'
import { useKbd } from '../../lib/commands'
import { usePlayer } from '../../store/player'
import { useUiStore } from '../../store/ui'
import { IconButton, cn } from '../ui/primitives'

/** Carica suoni nella libreria (nella cartella indicata) e restituisce gli id creati. */
export async function importSounds(folder = ''): Promise<string[]> {
  const imported = await window.graforum.importSounds()
  if (imported.length === 0) return []
  apply('Carica suoni', (d) => {
    for (const s of imported) d.sounds.push({ id: s.id, fileName: s.fileName, title: s.fileName.replace(/\.[^.]+$/, ''), tags: [], mime: s.mime, folder })
  })
  return imported.map((s) => s.id)
}

/** 83 → "1:23". */
export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Pulsante riproduci/pausa di un suono: mentre suona è quello attivo del player. */
export function PlayButton({ id, className }: { id: string; className?: string }) {
  const active = usePlayer((s) => s.soundId === id)
  const playing = usePlayer((s) => s.playing)
  const toggle = usePlayer((s) => s.toggle)
  const on = active && playing
  return (
    <button
      type="button"
      title={on ? 'Pausa' : 'Ascolta'}
      onClick={() => toggle(id)}
      className={cn('grid size-7 flex-none place-items-center rounded-full border border-line2 hover:bg-hover', on ? 'border-ac bg-acbg text-ac' : 'text-tx2', className)}
    >
      {on ? <Pause size={13} /> : <Play size={13} className="translate-x-px" />}
    </button>
  )
}

const Range = ({ value, max, onChange, label, className }: { value: number; max: number; onChange(v: number): void; label: string; className?: string }) => (
  <input
    type="range"
    aria-label={label}
    min={0}
    max={max || 1}
    step="any"
    value={Math.min(value, max || 1)}
    onChange={(e) => onChange(Number(e.target.value))}
    className={cn('h-1 min-w-0 cursor-pointer accent-[var(--ac)]', className)}
  />
)

/** Player: titolo del suono attivo, barra di avanzamento, ripetizione, volume. Mostra sempre il suono attivo, ovunque sia stato avviato. */
export function PlayerBar({ className }: { className?: string }) {
  const p = useProject()
  const { soundId, playing, time, duration, loop, failed, toggle, stop, seek, setLoop, setVolume } = usePlayer()
  const volume = useUiStore((s) => s.volume)
  const kbd = useKbd('togglePlayback')
  const sound = soundId ? p.sounds.find((s) => s.id === soundId) : undefined
  const total = duration
  return (
    <div data-testid="player" className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line2 bg-sunken px-3 py-2', className)}>
      <IconButton
        icon={playing ? Pause : Play}
        size={15}
        className="size-8"
        disabled={!soundId}
        title={`${playing ? 'Pausa' : 'Riproduci'}${kbd ? ` (${kbd})` : ''}`}
        onClick={() => toggle()}
      />
      <IconButton icon={Square} size={13} className="size-8" disabled={!soundId} title="Ferma" onClick={stop} />
      <div className="flex min-w-[10rem] flex-1 basis-48 flex-col gap-1">
        <span className={cn('truncate text-[12px] font-medium', !sound && 'text-tx3')}>{sound ? sound.title || sound.fileName : 'Nessun suono: scegline uno con ▶'}</span>
        <div className="flex items-center gap-2">
          <span className="w-9 flex-none text-right font-mono text-[10.5px] text-tx3">{formatTime(time)}</span>
          <Range label="Posizione" className="flex-1" value={time} max={total} onChange={seek} />
          <span className="w-9 flex-none font-mono text-[10.5px] text-tx3">{formatTime(total)}</span>
        </div>
        {failed && <span className="text-[11px] text-err">File non riproducibile.</span>}
      </div>
      <IconButton icon={Repeat} size={14} className={cn('size-8', loop && 'bg-acbg text-ac')} title={loop ? 'Ripetizione attiva' : 'Ripeti in loop'} onClick={() => setLoop(!loop)} />
      <div className="flex w-[120px] flex-none items-center gap-1.5">
        {volume === 0 ? <VolumeX size={14} className="flex-none text-tx3" /> : <Volume2 size={14} className="flex-none text-tx3" />}
        <Range label="Volume" className="flex-1" value={volume} max={1} onChange={setVolume} />
      </div>
    </div>
  )
}
