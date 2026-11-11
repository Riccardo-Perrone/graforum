// Confronto di testo per tutte le ricerche dell'app: un solo posto dove si decide come si confronta.
// Regola: maiuscole e minuscole sono uguali, gli accenti contano ("città" non trova "citta" e viceversa).

/** Forma di confronto di un testo. Non cambia la lunghezza, quindi gli indici valgono anche sul testo originale. */
export const searchKey = (text: string): string => text.toLocaleLowerCase('it')

/** Vero se il testo contiene la ricerca (una ricerca vuota trova tutto). */
export function matchesQuery(text: string, query: string): boolean {
  const q = searchKey(query.trim())
  return !q || searchKey(text).includes(q)
}

/** Vero se almeno uno dei testi contiene la ricerca. */
export const matchesAny = (query: string, ...texts: (string | null | undefined)[]): boolean =>
  !query.trim() || texts.some((t) => !!t && matchesQuery(t, query))

/** Posizione della ricerca nel testo (-1 se assente), per evidenziare o estrarre un brano. */
export function matchIndex(text: string, query: string): number {
  const q = searchKey(query.trim())
  return q ? searchKey(text).indexOf(q) : -1
}
