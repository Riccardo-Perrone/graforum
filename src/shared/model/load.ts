import { Project, SCHEMA_VERSION } from './project'

/**
 * Legge un progetto dal JSON grezzo. Esiste un solo formato: un file salvato da una versione
 * più recente di Graforum si rifiuta con un messaggio chiaro, invece di fallire sulla validazione.
 */
export function loadProject(input: unknown): Project {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Il file non contiene un progetto Graforum')
  const version = (input as Record<string, unknown>)['schemaVersion']
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    throw new Error(`Il progetto è stato salvato con una versione più recente di Graforum (formato ${version}, questa versione arriva al ${SCHEMA_VERSION}). Aggiorna l’applicazione per aprirlo.`)
  }
  return Project.parse(input)
}
