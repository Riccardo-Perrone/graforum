---
description: Compatibilità dei file .dng quando cambia il modello dati
paths:
  - "src/shared/model/**"
  - "src/main/projectFile.ts"
  - "src/shared/export/exporter.ts"
  - "docs/modello-dati-v3.md"
---

# Modello dati: i file vecchi devono restare apribili

Gli utenti hanno `.dng` salvati con versioni precedenti. Ogni cambio allo schema Zod deve lasciarli leggibili.

- **Compatibile** (campo nuovo con `.default(...)`, `.optional()`, enum allargato): nessuna migrazione, `SCHEMA_VERSION` invariata.
- **Incompatibile** (campo rinominato, rimosso o con tipo diverso, struttura cambiata, vincolo più stretto, enum ristretto):
  1. `SCHEMA_VERSION` + 1 in `model/project.ts`.
  2. Aggiungi `MIGRATIONS[versioneVecchia]` in `model/migrate.ts`: funzione pura sul JSON grezzo che porta da N a N+1. Non usare gli schemi Zod (descrivono solo l'ultima versione). Non modificare mai migrazioni già presenti.
  3. Aggiungi un test in `model/migrate.test.ts` con un progetto della versione vecchia.
  4. Aggiorna `docs/modello-dati-v3.md`.
- Il parse con `Project` avviene sempre dopo la migrazione: non adattare i dati vecchi altrove.
- Un file più nuovo dell'app si rifiuta con errore e non si riscrive.
- Se il file è migrato, il main ne salva una copia `<file>.v<N>.bak` prima del primo salvataggio: non toglierla.
