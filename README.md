# Graforum

Editor di grafo narrativo D&D per Windows: Electron + React + TypeScript.

- Requisiti e decisioni sul modello: [docs/modello-dati-v3.md](docs/modello-dati-v3.md)

## Comandi

```bash
npm install
npm run dev        # avvia l'app con ricarica a caldo
npm test           # test (Vitest)
npm run smoke      # prova nell'app vera, dopo `npm run build`
npm run typecheck
npm run dist       # installer Windows (NSIS) in dist/, senza pubblicare
npm run release    # come dist, ma pubblica il rilascio su GitHub (serve GH_TOKEN)
npm run icon       # rigenera build/icon.*
```

## Struttura

| Cartella                       | Contenuto                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/shared/model`             | Schemi Zod del modello (fonte di verità), id, indice "Usato in", migrazioni dei file              |
| `src/shared/engine`            | Logica pura: condizioni, validazione, percorso decisivo, fonti dei requisiti                      |
| `src/shared/export` · `sample` | Export JSON/HTML/PDF e import · progetto di esempio "La locanda del Corvo" (usato anche nei test) |
| `src/main`                     | Processo principale Electron: finestra, file `.dng` (zip), IPC, aggiornamenti                     |
| `src/preload`                  | API `window.graforum` esposta al renderer                                                         |
| `src/renderer`                 | Interfaccia React: shell, dock di schede (`dock/`), canvas (React Flow), catalogo                 |
| `scripts`                      | `smoke.cjs` (prova nell'app vera), `screenshot.cjs`, `make-icon.cjs`                              |
| `docs`                         | `sviluppo.md` (stato e architettura), `modello-dati-v3.md` (decisioni sul modello)                |

Ogni modifica al progetto passa da `useProjectStore().apply(...)`, che registra le patch per annulla/ripeti. Le regole per chi sviluppa (anche con un agente) sono in `CLAUDE.md`.

## Rilasciare una versione

1. Aumenta `version` in `package.json` (es. `0.1.0` → `0.2.0`) e fai commit e push.
2. Imposta un token GitHub con permesso di scrittura sui contenuti della repo: in PowerShell `$env:GH_TOKEN = "…"`.
3. `npm run release`: costruisce l'installer e lo carica come rilascio su GitHub, con `latest.yml`.
4. Le app installate, se la repo è pubblica, trovano la nuova versione da Impostazioni › Aggiornamenti (o dalla Home) e si aggiornano con un pulsante.

I progetti `.dng` non fanno parte dell'app: un aggiornamento non li tocca. Se cambia il modello dati, vedi `.claude/rules/modello-dati.md`.
