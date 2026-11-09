import { Project, SCHEMA_VERSION } from './project'

// Migrazione dei progetti salvati con versioni precedenti del formato (§2 di docs/modello-dati-v3.md).
// Regole per chi cambia il modello: .claude/rules/modello-dati.md

export type RawProject = Record<string, unknown>

/** Porta il JSON grezzo di un progetto dalla versione N alla N+1. Può modificare e restituire la copia ricevuta. */
export type Migration = (raw: RawProject) => RawProject

/**
 * Migrazioni per versione di partenza: `MIGRATIONS[1]` porta dalla 1 alla 2, e così via.
 * Lavorano sul JSON grezzo (non sugli schemi Zod, che descrivono solo l'ultima versione). Non si modificano quelle già scritte.
 */
export const MIGRATIONS: Record<number, Migration> = {}

/** Applica in sequenza le migrazioni necessarie; restituisce il JSON alla versione `target` e quella di partenza. */
export function migrateRaw(input: unknown, migrations: Record<number, Migration> = MIGRATIONS, target = SCHEMA_VERSION): { raw: RawProject; fromVersion: number } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Il file non contiene un progetto Graforum')
  let raw = structuredClone(input) as RawProject
  // Senza numero di versione si tratta di un file del primo formato.
  const from = raw['schemaVersion'] ?? 1
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) throw new Error('Numero di versione del progetto non valido')
  if (from > target) {
    throw new Error(`Il progetto è stato salvato con una versione più recente di Graforum (formato ${from}, questa versione arriva al ${target}). Aggiorna l’applicazione per aprirlo.`)
  }
  for (let v = from; v < target; v++) {
    const step = migrations[v]
    if (!step) throw new Error(`Manca la migrazione del progetto dal formato ${v} al ${v + 1}`)
    raw = { ...step(raw), schemaVersion: v + 1 }
  }
  return { raw, fromVersion: from }
}

/** Legge un progetto di qualunque versione supportata e lo restituisce nel formato corrente. */
export function migrateProject(input: unknown): { project: Project; fromVersion: number } {
  const { raw, fromVersion } = migrateRaw(input)
  return { project: Project.parse(raw), fromVersion }
}
