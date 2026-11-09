// Colori per etichette e copertine delle scene.

export const LABEL_PALETTE = ['#2f9e6b', '#c9a227', '#d9772b', '#c8453b', '#9b59c9', '#4a6fe3', '#2b9fc0', '#d6568f', '#6b7280', '#3b3f4a']

/** Bianco o nero, a seconda di quale legge meglio sopra il colore dato (#rrggbb). */
export function readableOn(color: string): '#fff' | '#14161b' {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color.trim())
  if (!m) return '#fff'
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.4 ? '#14161b' : '#fff'
}
