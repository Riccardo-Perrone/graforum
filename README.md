# Graforum

Editor di **grafo narrativo per D&D** (Windows). Disegni l'avventura come un grafo di scene collegate e ci attacchi tutto ciò che serve al tavolo: PNG, dialoghi, incontri, oggetti, quest, prove di abilità.

## Cosa fa

- **Grafo delle scene** con collegamenti, gruppi annidati e comprimibili, minimappa, aggancio dei nodi e selezione multipla.
- **Cataloghi** di NPC, enemy, oggetti e quest, con l'elenco "Usato in" e protezione da eliminazioni che romperebbero l'avventura.
- **Condizioni ed effetti** riusabili: accessi bloccati o nascosti, flag, prove di abilità, esiti degli incontri, requisiti delle quest.
- **Dialoghi** a battute e scelte, con "Prova dialogo".
- **Playtest** dell'avventura: percorso, inventario, quest e flag modificabili, preset.
- **Documenti di progetto** in Markdown, con link alle entità.
- **Validazione** (scene irraggiungibili, vicoli ciechi, riferimenti rotti…), ricerca, filtri e viste incrociate.
- **Esportazione** in JSON, HTML e PDF per il tavolo; importazione JSON.
- **Schede agganciabili stile Unity**: pannelli spostabili a sinistra, destra, in basso o al centro, ingrandibili e staccabili in finestre vere.
- Scorciatoie modificabili, tema chiaro/scuro, scala dell'interfaccia, annulla/ripeti e salvataggio automatico.

## Installare

1. Scarica `Graforum Setup <versione>.exe` dall'ultima [release](https://github.com/Riccardo-Perrone/graforum/releases/latest) ed eseguilo.
2. Windows può mostrare l'avviso "editore sconosciuto" (l'installer non è firmato): scegli **Maggiori informazioni → Esegui comunque**.

Dopo l'installazione l'app cerca da sola le nuove versioni all'avvio. Puoi anche farlo da **Impostazioni › Aggiornamenti** o dalla Home, e aggiornare con un pulsante. L'aggiornamento non tocca i tuoi progetti.

## I tuoi progetti

Ogni progetto è un unico file `.dng` (un archivio zip con `project.json` e le immagini) che salvi dove vuoi. Il salvataggio è atomico e tiene una copia `.bak`. I file creati con versioni precedenti dell'app si aprono sempre: se il formato è cambiato vengono aggiornati, conservando l'originale come `nome.dng.v<N>.bak`. Un file più recente dell'app viene rifiutato senza essere modificato.

## Sviluppo

Serve Node.js recente (testato con la 24).

```bash
npm install
npm run dev        # app con ricarica a caldo
npm test           # test (Vitest)
npm run typecheck  # tipi di main e renderer
npm run build      # compila in out/
npm run smoke      # prova nell'app vera, dopo `npm run build`
npm run dist       # installer Windows (NSIS) in dist/, senza pubblicare
npm run release    # come dist, ma pubblica il rilascio su GitHub (serve GH_TOKEN)
npm run icon       # rigenera build/icon.*
```

### Struttura

| Cartella                       | Contenuto                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/shared/model`             | Schemi Zod del modello (fonte di verità), id, indice "Usato in", migrazioni dei file              |
| `src/shared/engine`            | Logica pura: condizioni, validazione, percorso decisivo, fonti dei requisiti                      |
| `src/shared/export` · `sample` | Export JSON/HTML/PDF e import · progetto di esempio "La locanda del Corvo" (usato anche nei test) |
| `src/main`                     | Processo principale Electron: finestra, file `.dng`, IPC, aggiornamenti                           |
| `src/preload`                  | API `window.graforum` esposta all'interfaccia                                                     |
| `src/renderer`                 | Interfaccia React: shell, dock di schede (`dock/`), canvas (React Flow), cataloghi                |
| `scripts`                      | `smoke.cjs` (prova nell'app vera), `screenshot.cjs`, `make-icon.cjs`                              |
| `docs`                         | `sviluppo.md` (stato e architettura), `modello-dati-v3.md` (decisioni sul modello)                |

Ogni modifica al progetto passa da `useProjectStore().apply(...)`, che registra le patch per annulla/ripeti. Le regole per chi sviluppa (anche con un agente) sono in `CLAUDE.md`; se cambi il modello dati leggi `.claude/rules/modello-dati.md`.

### Rilasciare una versione

1. Aumenta `version` in `package.json` (es. `0.1.0` → `0.2.0`), poi commit e push.
2. Imposta un token GitHub con permesso di scrittura sui contenuti della repo: in PowerShell `$env:GH_TOKEN = "…"` (mai nei file).
3. `npm run release`: costruisce l'installer e lo pubblica come release, con `latest.yml` e `.blockmap`. Le note scritte nella descrizione della release compaiono nell'app.
4. Le app installate trovano la nuova versione e propongono l'aggiornamento.

La versione deve essere sempre più alta di quella già pubblicata.
