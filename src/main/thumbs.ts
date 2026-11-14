import { extname } from 'node:path'
import { nativeImage } from 'electron'
import type { Thumb } from './projectFile'

/** Larghezza massima delle miniature (la tessera più grande della Libreria è ~180 px, doppia per gli schermi ad alta densità). */
const THUMB_WIDTH = 400

/**
 * Miniatura di un'immagine, o null se non serve (già piccola) o non si può fare (svg, file illeggibile): in quei casi si usa l'originale.
 * Le immagini con trasparenza (png, gif, webp) restano png, le altre diventano jpeg.
 */
export function makeThumb(data: Uint8Array, fileName: string): Thumb | null {
  try {
    const ext = extname(fileName).toLowerCase()
    if (ext === '.svg') return null
    const image = nativeImage.createFromBuffer(Buffer.from(data))
    if (image.isEmpty() || image.getSize().width <= THUMB_WIDTH) return null
    const small = image.resize({ width: THUMB_WIDTH, quality: 'good' })
    return ['.png', '.gif', '.webp'].includes(ext) ? { data: new Uint8Array(small.toPNG()), mime: 'image/png' } : { data: new Uint8Array(small.toJPEG(80)), mime: 'image/jpeg' }
  } catch {
    return null
  }
}
