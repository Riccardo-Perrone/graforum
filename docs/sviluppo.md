# Graforum – guida allo stato del progetto

Descrive com'è fatta l'app **oggi**, per continuare a lavorarci senza rileggere la cronologia (che sta nei commit). Regole obbligatorie per chi scrive codice: `CLAUDE.md`. Cosa contiene il progetto e perché: `docs/modello-dati-v3.md`. Come si rilascia: `README.md`.

## Fonti esterne (non nella repo)

- **Requisiti funzionali v2:** documento dell'autore, tenuto fuori dalla repo. Le decisioni successive sono in `docs/modello-dati-v3.md` e hanno la precedenza; per lo sviluppo corrente basta il modello dati.
- **Design:** progetto Claude Design "Editor grafo narrativo" (account dell'autore). Token e misure sono già in `styles.css` e nei componenti: serve solo per progettare schermate nuove.
- **Editor di testo del design:** per scelta dell'utente è sostituito dai **Documenti di progetto** (Markdown con link `@[Testo](tipo:id)`).

## Comandi di lavoro

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | App con ricarica a caldo (porta del server Vite, origine `localhost`) |
| `npx tsc -p tsconfig.web.json --noEmit` · `npm run typecheck` | Tipi del renderer · tipi di main e renderer |
| `npx vitest run` | Test (`src/**/*.test.ts`, elenco in [Test](#test)): modello, motore, export, file `.dng`, scorciatoie, annulla/ripeti, grafo, ricerca, dock |
| `npm run build && npm run smoke` | Prova nell'app vera (Electron su `out/`): grafo, gruppi, menu contestuale, dock, finestre modali, overflow a 260px |
| `electron scripts/screenshot.cjs <cartella> <passi.json>` | Passi JS nella pagina + screenshot (`win: "popout"` fotografa una scheda staccata). Prima serve `npm run build` |
| `npm run dist` · `npm run release` · `npm run icon` | Installer · installer + pubblicazione GitHub · rigenera `build/icon.*` |

Dopo ogni modifica: tipi e test devono passare. Se tocchi il canvas, anche lo smoke (e aggiungi un controllo a `scripts/smoke.cjs` per ogni nuova interazione).

## Stack

Electron 44, electron-vite 6 + Vite 8, React 19, TypeScript 7 strict, Tailwind 4 (token in `styles.css`, tema chiaro con `data-theme="light"` su `<html>`), @xyflow/react 12, `dockview-react` 8.9, Zustand 5 + Immer 11 (patch per annulla/ripeti), Zod 4, CodeMirror 6 (documenti), lucide-react, fflate, `electron-updater`, font Geist. Test: Vitest 5.

## Architettura

```
src/shared   Puro, senza Electron né React: modello Zod, motore (engine), export, progetto di esempio, tipi IPC
src/main     Processo principale: finestra, file .dng, immagini, IPC, protocolli, aggiornamenti
src/preload  Espone window.graforum (tipo GraforumApi in shared/ipc.ts)
src/renderer Interfaccia React
  store/       project.ts (progetto + annulla/ripeti), ui.ts (stato UI + Prefs), updates.ts
  lib/         commands.ts + shortcuts.ts (scorciatoie), entities.tsx, sceneOps.ts, fileActions.ts, labels.ts (colori), cursors.ts
  dock/        schede agganciabili (vedi sotto)
  components/  ui (primitive), graph, scene, catalog, logic, search, cross, validation, export, settings, shell
  screens/     Home, SheetHost, e i corpi delle schede Dialoghi, Documenti, Playtest
```

- **Alias:** `@shared` → `src/shared`, `@renderer` → `src/renderer/src`.
- **Logica nel posto giusto:** valutazione, validazione, indici, descrizioni stanno in `src/shared/engine` con test; la UI le richiama senza duplicarle.
- **Il main non conosce lo stato dell'app:** tiene solo le immagini del progetto aperto (in memoria, finiscono nel `.dng` al salvataggio) e risponde agli IPC.

### Mappa dei file: dove sta cosa

Prima di scrivere un aiuto nuovo, cerca qui: quasi tutto ciò che serve in più punti esiste già.

| Serve… | Dove |
| --- | --- |
| Schema di un'entità e suoi valori predefiniti | `shared/model/graph.ts` (scene, collegamenti, gruppi, finali, incontri), `catalog.ts` (NPC, enemy, oggetti, quest, dialoghi), `logic.ts` (condizioni, gate, effetti, prove), `project.ts` (progetto, impostazioni, libreria) |
| Creare un'entità vuota | `shared/model/factories.ts`: `makeScene`, `makeLink`, `makeGroup`, `makeEncounter`, `makeEnding` (colori da `ENDING_COLORS` in `graph.ts`), `makeDialogLine`, `makeDialogChoice`; per i cataloghi `Npc.parse({ id, name })` ecc. o `createEntity` (`lib/entities.tsx`) |
| Id nuovi, prefissi, riferimenti `{ type, id }` | `shared/model/ids.ts` (`newId`, `ID_PREFIX`, `Ref`) |
| Chi usa un'entità ("Usato in"), link nei documenti | `shared/model/usage.ts` (`buildUsageIndex`, `DOC_LINK`) |
| Nome leggibile, frasi su condizioni ed effetti | `shared/engine/describe.ts` (`entityName`, `describeCondition`, `describeEffect`, `checkName`) |
| Riferimenti rotti, elenco delle prove, id esistenti | `shared/engine/refs.ts` (`findRefs`, `allChecks`, `existingIds`, `TYPE_NAMES`) |
| Transizioni, raggiungibilità, percorso decisivo, unicità dei collegamenti | `shared/engine/graph.ts` (`transitions`, `reachableFromStart`, `decisivePath`, `canLink`) |
| Gruppi annidati e selezione per gruppi | `shared/engine/groups.ts`: gerarchia (`groupDescendants`, `groupAncestors`, `isGroupOrAncestor`, `commonAncestor`, `canMoveGroupInto`), gruppi selezionati per intero (`fullySelectedGroups`, `selectedGroups`, `selectionParts`), piani di `Raggruppa` e del rilascio su un gruppo (`planGrouping`, `planMoveInto`), pulizia di entrate/uscite (`pruneGroupEnds`) |
| Incontri che restano senza scena e chi ne blocca l'eliminazione | `shared/engine/encounters.ts` (`encountersOrphanedBy`, `encountersWithoutScene`, `encounterBlockers`) |
| Confronto del testo nelle ricerche (maiuscole uguali, accenti distinti) | `shared/engine/text.ts` (`matchesQuery`, `matchesAny`, `matchIndex`) |
| Fonti di un requisito, effetti del progetto, scene di un dialogo | `shared/engine/sources.ts` (`effectSites`, `sourcesOf`, `stepsSatisfiedBy`, `scenesWithDialog`, `leaves`) |
| Problemi del progetto | `shared/engine/validate.ts`: nel renderer usa `validateCached(p)` (una sola valutazione per versione del progetto); ogni problema ha un `code` stabile (`IssueCode`) |
| Playtest | `shared/engine/evaluate.ts` (`initialPlayState`, `evalCondition`, `gateStatus`, `applyEffects`, `updateState`) |
| Elenco dialoghi | `shared/engine/dialogList.ts` (`listDialogEntries`, `filterDialogs`) |
| Modificare il progetto | `store/project.ts` (`apply`, `undo`, `redo`); `lib/entities.tsx` (`apply`, `useProject`, `getProject`, `options`, `createEntity`) |
| Operazioni su scene, gruppi e incontri (creare, duplicare, eliminare con conferma, togliere un incontro, raggruppare) | `lib/sceneOps.ts` |
| Avviare il playtest (stesse regole per pulsanti, menu e scorciatoie) | `lib/playtest.ts` (`playFromStart`, `playFromScene`, `canPlayFromStart`) |
| Scorciatoie | `lib/commands.ts` (registro `COMMANDS`, `useKbd`, `kbdLabel`), `lib/shortcuts.ts` (`useCommand`, `useCloseKey`) |
| Aprire una scheda o un'entità | `store/ui.ts` (`setView`, `openSheet`, `openEntity`), `dock/bridge.ts` (`dockBridge.openPanel`) |
| Disposizione del grafo (nodi, archi, gruppi collassati) | `components/graph/buildGraph.ts` (`buildGraph`, `sceneTopLeft`); aggancio in `snap.ts` |
| Conferma, finestra modale, menu a comparsa | `components/ui/ConfirmDialog.tsx` (`confirmDialog`), `ui/Sheet.tsx` (`Sheet`, `Section`, `EditHint`), `ui/form.tsx` (`useClickOutside`: clic fuori o Esc) |
| Campo di ricerca | `components/ui/SearchInput.tsx` (lente, svuota, filtro mentre si scrive): ogni ricerca dell'app lo usa, con `matchesQuery` per il confronto |
| Player dei suoni (un solo audio per tutta l'app, volume in `Prefs.volume`) e suo aspetto | `store/player.ts` (`usePlayer`: `toggle`, `stop`, `seek`, `setLoop`), `components/sounds/SoundPlayer.tsx` (`PlayButton`, `PlayerBar`, `importSounds`) |
| Pulsanti, chip del tag, classi | `components/ui/primitives.tsx` (`DangerButton`, `ToolbarButton`, `IconButton`, `TagChip`, `cn`) |

## Convenzioni

- Interfaccia e commenti in italiano, commenti brevi.
- Id prefissati: `newId('scene')` → `scn_xxxxxxxxxx`. Il progetto di esempio usa id leggibili fissi (es. `scn_cantina`).
- Le modifiche al progetto passano solo da `useProjectStore().apply(etichetta, bozza => …, mergeKey?)`. Gli helper di `lib/entities.tsx` (`apply`, `useProject`, `options`) lo avvolgono.
- Nuove impostazioni dell'app in `Prefs` (`store/ui.ts`, localStorage `graforum.prefs`), lette e scritte con `setPrefs`. Prefs attuali: `theme`, `uiScale`, `textScale`, `snap`, `shortcuts`, `autoCheckUpdates`, `layout`, `volume` (player dei suoni), `libraryView` (elenco / icone piccole / icone grandi della Libreria), `libraryTree` (albero delle cartelle mostrato o nascosto), `savedFilters` (viste dei filtri; prima stavano in `graforum.savedFilters`, che si legge ancora una volta per recuperarle). I progetti recenti (`graforum.recent`) sono una cronologia, non un'impostazione, e restano a parte.
- Stile: misure del README di handoff (controlli 28–32px, etichette di categoria mono 10px maiuscolo, sezioni numerate "01 · ETICHETTA"). Token colore: `tx/tx2/tx3`, `ac`, `safe`, `warn`, `err`, `line/line2`, `raised/sunken/panel/hover`.
- Layout responsive: righe con `flex-wrap`, `min-w-0` e `basis-*` al posto di larghezze fisse (un `flex-1` in una riga che va a capo ha bisogno di `basis-1`, una riga `flex-col` con wrap va in `flex-nowrap`).
- Entità nuove con le fabbriche di `shared/model/factories.ts` (o `Schema.parse({ id, … })`): niente oggetti scritti campo per campo, così un campo aggiunto allo schema vale ovunque.
- **Ricerca:** ogni campo di ricerca è un `SearchInput` e ogni confronto passa da `matchesQuery`/`matchesAny`/`matchIndex`: maiuscole indifferenti, accenti distinti («città» non trova «citta»). Per cambiare la regola basta `shared/engine/text.ts`.
- **Incontri:** un incontro esiste solo dentro le scene. Eliminando una scena o togliendo un incontro dalla sua ultima scena, l'incontro si elimina (con conferma); se qualcosa lo usa ancora (es. un requisito di quest) l'operazione si blocca e mostra "Usato in".
- **Tastiera:** i comandi di ambito `graph` e `dialog` tacciono mentre è aperta una finestra modale (`ui.sheet`). Menu e riquadri a comparsa si chiudono con la combinazione di `closeSheet` tramite `useClickOutside` o `useCloseKey`, che fermano il tasto prima degli altri ascoltatori. I tasti dentro i campi di testo (Invio conferma, Esc annulla, frecce nei menu a tendina) sono comportamento del controllo, non comandi.

## Stato per area

### Modello e file
- Schemi in `src/shared/model`; indice inverso "Usato in" (`buildUsageIndex`); `createEmptyProject`.
- `.dng` = zip con `project.json` + `media/` + `sound/` (con le sottocartelle della libreria, anche vuote: `sound/Musica/Taverna/<id>.mp3`); scrittura atomica con `.bak`; autosalvataggio dopo 2 s dall'ultima modifica, solo se il progetto ha già un file. Recenti in localStorage (`graforum.recent`, 8 voci). Immagini lette come `graforum-img://lib/<id>`.
- **Versioni:** `SCHEMA_VERSION` = 1. Nessuna migrazione e nessuna compatibilità con file vecchi (non ne esistono): si cambia lo schema liberamente. `loadProject` (`model/load.ts`) rifiuta solo i file più nuovi dell'app.

### Motore (`src/shared/engine`)
Descrizioni in parole (`describe`), valutazione per il playtest con avanzamento automatico degli step (`evaluate`), transizioni, raggiungibilità, percorso decisivo e unicità dei collegamenti (`graph`), gerarchia dei gruppi (`groups`), fonti dei requisiti (`sources`), elenco "Avanzamento" (`progress`), elenco dialoghi (`dialogList`).

**Validazione** (`validate`, nel renderer `validateCached`):
- *Errori* (bloccano l'export nell'ambito): partenza mancante, scena Warning senza incontro, incontro senza enemy, finale senza etichetta o colore, riferimento a entità eliminata, dialogo senza battuta iniziale.
- *Avvisi:* scena irraggiungibile, vicolo cieco (nessuna uscita e non finale), incontro senza scena, gruppo senza entrata o uscita, condizione impossibile (nessuno produce oggetto, flag, stato di quest, dialogo o esito richiesto).
- *Note:* step senza requisiti, dialogo mai assegnato, enemy mai usato, oggetto senza immagine.
- **Correzioni rapide** (pulsante con la chiave inglese accanto al problema, `ValidationPanel.quickFix`): partenza = prima scena, aggiungi incontro, segna come finale, prima scena del gruppo (o dei sottogruppi) come entrata/uscita, elimina l'incontro senza scena. Si scelgono dal `code` del problema, quindi cambiare titoli e testi non le rompe.

### Canvas (`components/graph`)
Nodi scena, archi "floating" con scostamento per andata/ritorno, gruppi annidati e collassabili, minimappa, snap stile Figma (`snap.ts`, Alt lo sospende), selezione multipla (riquadro col sinistro, vista col centrale), menu contestuale (agisce su tutta la selezione se la scena cliccata ne fa parte, Esc lo chiude), trascinamento dal catalogo (NPC e oggetti si aggiungono alla scena, un enemy crea un incontro e rende la scena Warning).

**Selezione e gruppi:**
- Un gruppo è *selezionato* quando lo sono tutte le sue scene, anche dei sottogruppi; una carta di gruppo collassato selezionata (`ui.selectedCardIds`) conta come gruppo intero. Il gruppo aperto selezionato ha fondo e bordo appena tinti d'accento (`groupSelected` nei dati del nodo); la barra di stato lo nomina.
- **Raggruppa la selezione** (`groupSelection`): i gruppi selezionati per intero restano gruppi e diventano sottogruppi del nuovo; le altre scene entrano direttamente; il nuovo gruppo nasce nell'antenato comune più vicino. Le posizioni non cambiano, quindi un gruppo uscito dal suo vecchio genitore può restarne sopra finché non lo sposti.
- **Rilascio su un gruppo** (tenere fermo ~1 s sull'area, poi rilasciare): vale per scene, gruppi trascinati dall'etichetta, carte collassate e gruppi selezionati per intero, che entrano come sottogruppi. Non si entra in se stessi o in un discendente, né nel genitore o in un antenato (si sale solo con "Rimuovi dal gruppo").
- Dopo ogni spostamento `pruneGroupEnds` toglie entrate e uscite che non sono più scene del gruppo o dei sottogruppi. Un gruppo si trascina dall'etichetta; tenendo scene ~1 s sull'area di un gruppo le si aggiunge. Il clic su un gruppo lo seleziona e apre la scheda "Scheda". Scena: copertina stile Trello, etichette personalizzate, tag nascondibile.

### Dock di schede (`src/renderer/src/dock`)
- `dockview-react`; il grafo è al centro, aree sinistra/destra/basso sono *edge group* comprimibili. Schede (`panelList.ts`): `graph`, `inspector` ("Scheda": scena o gruppo secondo la selezione), `catalog`, `validation`, `playtest`, `dialogs`, `documents`, `library` (Libreria: sezioni Immagini e Suoni, `screens/LibraryView.tsx`; parametro `tab`). `PANEL_AREA` dice solo dove nasce una scheda nel layout standard; poi si sposta ovunque.
- **Aprire una scheda:** `useUiStore().setView(...)`, `openEntity(...)` o `dockBridge.openPanel(id, params)` (`bridge.ts`, compilato da `DockHost`). Toglie un ingrandimento, espande l'area compressa, attiva la scheda; se chiusa la riapre nel centro. I menu Vista/Finestra aprono sempre; i `toggle…` e il pulsante Validazione chiudono solo se la scheda è già in vista. Il bridge non ha import, per evitare cicli con lo store.
- **Dialoghi:** elenco ed editor sono la stessa scheda (`dialogs`; il parametro `dialogId` apre il dialogo, senza torna l'elenco). Non esistono pulsanti "Torna al grafo".
- **Ingrandisci** (`maximize.ts`, Ctrl+Spazio): chiude le aree laterali e porta al centro, finché dura, una scheda che stava in un'area (dockview non ingrandisce gli edge group).
- **Staccare** (`popout.ts`): `addPopoutGroup` + `window.open('/popout.html')`; stesso contesto JS, quindi store condivisi. Una scheda di un'area laterale passa prima al centro (dockview non stacca gli edge group). Tema e scala del testo si copiano nella finestra; le scorciatoie vi sono attaccate con `addShortcutWindow`.
- **Layout** salvato in `Prefs.layout` (validato da `isUsableLayout`; se non vale, layout standard); pulsante "Layout standard" in alto a destra (`resetLayout`); menu ⋯ su ogni gruppo (`PanelMenu.tsx`) per aprire qualsiasi scheda in quel gruppo; menu Finestra; comandi nel gruppo "Layout".
- `window.graforumDock` (API di dockview) e `window.graforumStores` (`{ ui, project }`) servono alle prove automatiche.

### Scheda scena e gruppo
`components/scene/SceneSheet.tsx` e `GroupSheet.tsx` hanno due forme: **scheda del dock** (`DockedScenePanel`, `DockedGroupPanel`, dentro `inspector`) e **finestra modale al centro** (`SceneSheet` 1120×944, `GroupSheet` 760×760, gestite da `SheetHost` con `ui.sheet`). Dalla scheda un pulsante "Apri in una finestra al centro" (anche nel menu contestuale), dalla finestra "Aggancia al dock". Tutto il resto (catalogo, impostazioni, immagini, viste incrociate, esportazione) è solo modale. Elimina con `DangerButton` + conferma.

### Dialoghi, Playtest, Documenti
- **Dialoghi:** editor a grafo con battute e scelte (`DialogEditor`), "Prova dialogo" (`DialogRunner`), elenco con filtri e raggruppamento.
- **Playtest** (`PlaytestView`, riparte da `params.nonce`): percorso, incontri Vinto/Fuga/Sconfitta, dialoghi con stato condiviso, negozio, raccolta, prove con esito manuale, inventario/quest/flag modificabili, preset, Indietro/Ricomincia, salto a una scena, "Mostra nel grafo". Barre laterali di larghezza fissa (300/400px).
- **Documenti** (`DocumentsView`): CodeMirror, completamento con `@`, struttura, anteprima con chip, scheda in miniatura al passaggio del mouse, clic che apre l'entità.

### Catalogo, ricerca, viste, validazione, export
- Catalogo con schede NPC/enemy/oggetto/quest (fonti collegate, "Usato in").
- **Libreria** (scheda del dock, Ctrl+Maiusc+L): media (le immagini, `Project.images`) e suoni come in un esplora file (`screens/LibraryView.tsx`): albero di cartelle, percorso, tre viste, trascinamento di file e cartelle per spostarli, ricerca su tutte le cartelle, tag (ortogonali alle cartelle), caricamento, eliminazione bloccata se in uso. `Image.folder` / `Sound.folder` ("A/B") e `Project.imageFolders` / `soundFolders` (cartelle vuote) coincidono con le cartelle dentro il `.dng`: il percorso nel file lo calcola sempre `mediaEntryPath` (`shared/model/media.ts`, con le operazioni `createFolder`/`moveFolder`/`deleteFolder`). Le tessere mostrano **miniature** (400 px di larghezza, `main/thumbs.ts`, `graforum-img://thumb/<id>`): si creano al caricamento e restano nel `.dng` sotto `thumbs/<id>.jpg|png`; senza miniatura (immagine già piccola, svg) si usa l'originale. I byte originali restano comunque in memoria. L'albero delle cartelle ha in cima «Nuova cartella» e il pulsante per comprimerlo; la radice si chiama come la cartella vera (`media`, `sound`). Il **player** (`PlayerBar`) sta in fondo alla sola sezione Suoni e sotto i suoni di una scena; un solo suono suona alla volta. Ogni scena ha una sezione "Suoni" (`Scene.soundIds`) con ▶ su ogni suono. Comandi: `library`, `togglePlayback`, `stopPlayback`. I suoni stanno in memoria nel main insieme alle immagini (stessa mappa, id con prefisso `snd`) e il protocollo `graforum-img` risponde anche alle richieste `Range`, così la barra del player può scorrere. Perché l'audio parta servono il privilegio `stream` dello schema e `media-src graforum-img:` nella CSP di `index.html`: senza, l'elemento audio dà errore.
- Ricerca Ctrl+K, filtri con viste salvate, selettore Percorso. Viste incrociate (`CrossViews`): dove serve un oggetto, quest nel grafo, NPC, enemy, avanzamento filtrabile con evidenziazione nel grafo.
- Pannello validazione con correzioni rapide (`highlight` nello store attenua il resto del grafo).
- Export JSON (senza dati solo-editor), HTML e PDF (senza immagini), zip con immagini; ambito tutto/gruppo/cataloghi; blocco per errori nell'ambito. Import JSON da File › Importa (passa da `loadProject`).

### Scorciatoie e impostazioni
- `lib/commands.ts` (`COMMANDS`: gruppi File, Modifica, Vista, Grafo, Dialoghi, Playtest, Schermate, Layout) + `useCommand`/`useKbd`; pagina Impostazioni › Scorciatoie con registrazione dei tasti, conflitti e ripristino. Esc (`closeSheet`) chiude la finestra in cima; `confirmDialog()` sostituisce `window.confirm`.
- Impostazioni del progetto (si salvano nel `.dng`): generale, abilità, tipi di oggetto, campi e condizioni custom, finali, flag. Impostazioni dell'app (localStorage): aspetto (tema, scala interfaccia, testo, snap), scorciatoie, aggiornamenti.

### Aggiornamenti e rilascio
`src/main/updater.ts` (`electron-updater`, rilasci GitHub di `Riccardo-Perrone/graforum`): il main tiene lo stato (`UpdateStatus`), il renderer lo rispecchia (`store/updates.ts`) nella scheda `UpdateCard` della Home e di Impostazioni › Aggiornamenti. Cerca → «Scarica e aggiorna» → «Riavvia e installa» (conferma se ci sono modifiche non salvate; altrimenti installa alla chiusura). `Prefs.autoCheckUpdates` cerca all'avvio senza scaricare. In sviluppo lo stato è `unsupported`. La procedura di rilascio è nel README.

### Icona
`scripts/make-icon.cjs` disegna in SVG un grafo di dadi (d4, d6, d8, d12, d20) a matita e produce `build/icon.svg`, `.png`, `.ico` (usata da electron-builder).

## Trappole note

- **Origine:** l'app compilata si carica da `graforum-app://app/` (dockview rifiuta `file://` per le finestre staccate). L'origine di localStorage differisce tra sviluppo (`localhost`), app compilata e installata: le preferenze non si trasferiscono.
- **Overlay del dock:** con `defaultRenderer="always"` il contenuto delle schede sta in un overlay con z-index 999 fuori dal gruppo. `DockHost` è `isolate` perché stia sotto finestre e menu dell'app; le schede nascoste forzano `visibility: hidden` ai discendenti (`styles.css`), altrimenti i nodi di React Flow di una scheda nascosta trasparirebbero. Per cercare il contenuto di una scheda nei test: `panel.view.content.element`.
- **Selettori nello smoke:** le finestre modali si riconoscono con `[data-sheet-level]`; il titolo della scheda scena è un `input`.
- **Dockview e gli edge group:** non si ingrandiscono né si staccano; per questo `maximize.ts` e `popout.ts` li portano al centro. `api.getGroup()` ha tipi poco comodi: si usa `api.groups.find(...)`.
- **Zod 4:** i default degli oggetti si scrivono con `.prefault({})`.
- **Tasti nello smoke:** gli eventi sintetici si inviano a `window`, non a un elemento: un ascoltatore messo su `document` non li riceve. Per questo `useCloseKey` ascolta sulla finestra, in cattura.
- **Ponte del dock e ricaricamento a caldo:** `dockBridge` si compila in un effetto (`connectDock` in `DockHost`), non in `onReady`. Se React riesegue gli effetti senza ricreare il dock (StrictMode, modifica di un file con `npm run dev`), il ponte si ricollega; prima restava vuoto e menu, scorciatoie e pulsanti che aprono le schede non facevano nulla.
- **Comandi globali fuori dalle schede:** playtest, validazione, avanzamento sono collegati in `App.tsx`, non nella barra del grafo: devono funzionare anche se la scheda Grafo è chiusa o non in vista. La ricerca (Ctrl+K) porta prima in vista il grafo, dove sta il campo.
- **Lo stesso tasto su due ascoltatori della `window`:** `stopPropagation` non ferma l'altro. Per dare la precedenza a un menu o a una conferma si ascolta in cattura (`useCloseKey`, `ConfirmHost`).

## Test

`npx vitest run` esegue tutti i file `src/**/*.test.ts` in Node (niente DOM). Si testano le parti pure; l'interfaccia vera la prova lo smoke.

| File | Cosa verifica |
| --- | --- |
| `shared/model/model.test.ts` | Id con prefisso; progetto vuoto con abilità e tipi predefiniti; esempio valido dopo un giro JSON; indice "Usato in"; suono associato a una scena (usato in, riferimenti) |
| `shared/model/factories.test.ts` | Le fabbriche `make*` producono entità che lo schema accetta, con i valori predefiniti attesi e id sempre nuovi; colori dei finali a rotazione; gruppo vuoto |
| `shared/model/load.test.ts` | Progetto corrente letto senza cambiarlo, file più nuovi rifiutati, input che non sono un progetto |
| `shared/engine/engine.test.ts` | Validazione dell'esempio (Warning senza incontro, vicolo cieco, riferimenti rotti, irraggiungibili); percorso decisivo; playtest con gate bloccato e avanzamento automatico degli step; descrizioni; fonti degli step; "Avanzamento"; elenco e filtri dei dialoghi |
| `shared/engine/evaluate.test.ts` | Stato iniziale e preset; ottenere/perdere oggetti; immutabilità; sblocca/blocca; avanzare a uno step; completare la quest; gruppi E/O; condizioni personalizzate; esiti degli incontri |
| `shared/engine/helpers.test.ts` | Discendenti e antenati dei gruppi (anche in ordine sparso e con cicli); `canLink`; `allChecks`/`checkName`; `scenesWithDialog`; confronto del testo (maiuscole uguali, accenti distinti, posizione); `validateCached` |
| `shared/engine/groups.test.ts` | Gruppi selezionati per intero (anche con carte collassate); antenato comune; Raggruppa con gruppi interi, scene sciolte e nel gruppo padre; rilascio di gruppi e selezioni in un gruppo, senza cicli né salite; pulizia di entrate e uscite |
| `shared/engine/encounters.test.ts` | Incontri resi orfani da eliminazione di scene o distacco; incontri in più scene; orfani preesistenti; avviso "Incontro senza scena"; chi blocca l'eliminazione; codici stabili dei problemi |
| `shared/export/exporter.test.ts` | Ambito gruppo (scene e catalogo usato); blocco solo per errori nell'ambito; JSON senza dati solo-editor e reimportabile; HTML senza script |
| `shared/model/media.test.ts` | Cartelle della libreria: percorso nel file, nomi validi, creazione annidata, sposta/rinomina (con file e sottocartelle), eliminazione che fa salire il contenuto |
| `main/projectFile.test.ts` | `.dng`: cartelle della libreria (anche vuote) dentro lo zip, salva e riapre identico, solo immagini e suoni in libreria (`media/`, `sound/`), copia `.bak`, file senza `project.json`, file più nuovi |
| `renderer/src/dock/layout.test.ts` | Layout salvati accettati o rifiutati (`isUsableLayout`); rimozione delle finestre staccate (`stripPopouts`) |
| `renderer/src/lib/commands.test.ts` | Registro delle scorciatoie: id unici, combinazioni predefinite senza conflitti e nel formato giusto, personalizzazioni, conflitti per ambito, etichette in italiano, lettura dei tasti |
| `renderer/src/lib/playtest.test.ts` | Playtest dall'inizio solo con scena di partenza (come il pulsante); dalla selezione o da una scena indicata |
| `renderer/src/store/project.test.ts` | `apply`, annulla/ripeti, `mergeKey`, limite di 200 passi, modifiche non salvate |
| `renderer/src/components/graph/buildGraph.test.ts` | Nodi e archi dell'esempio; ingombro dei gruppi annidati; gruppi collassati (carta, scene nascoste, archi spostati sulla carta); `sceneTopLeft` |
| `renderer/src/components/graph/snap.test.ts` | Aggancio a bordi e centri entro la soglia, guide, nessun aggancio oltre la soglia |
| `renderer/src/components/search/search.test.ts` | Ricerca globale (titoli, cataloghi, scene da evidenziare, accenti distinti); filtri per gruppo con sottogruppi, tag, finali, problemi, entità usata, combinati; viste salvate nelle preferenze |
| `scripts/smoke-library.cjs` (Electron, `npm run build && npx electron scripts/smoke-library.cjs`) | Libreria: player solo in Suoni; miniature (400 px, nel `.dng`); albero cartelle che si nasconde, con «Nuova cartella» in cima; mp3 caricato, letto e in avanzamento; cartelle (crea, annida, trascina file e cartelle, rinomina, nome non valido); tre viste; file salvato con le cartelle vere; caricamento di un suono dalla scena |
| `scripts/smoke.cjs` (Electron) | Etichette dei gruppi cliccabili; collassa/espandi; trascinamento dei gruppi; gruppo colorato quando tutte le sue scene sono selezionate; Raggruppa che tiene la Locanda intera come sottogruppo; gruppo trascinato e rilasciato dentro un altro; cursore di spostamento; etichette, copertina e tag dalla scheda scena; Canc con conferma; menu contestuale con Esc; tasti del grafo fermi sotto una finestra modale; scena con incontro usato da una quest non eliminabile; Ctrl+K da un'altra scheda; gruppo nella scheda; dock (layout standard, ingrandisci, aree, salvataggio, menu Finestra e ⋯); dialoghi nella stessa scheda; scheda scena modale e a 260px |

## Limiti noti

- Playtest, Documenti, Catalogo e Validazione non sono resi responsive a larghezze molto piccole (la scheda scena sì, fino a ~260px).
- Il grafo staccato in una finestra non è stato provato (il trascinamento dei gruppi ascolta il mouse sulla finestra principale). Le finestre staccate non si ripristinano al riavvio.
- Il giro completo di aggiornamento non è mai stato eseguito: serve un rilascio pubblicato e un'app installata. L'installer non è firmato (SmartScreen avvisa).
- Layout salvati con schede di versioni precedenti non più valide (es. `dialog-editor`) ripartono dal layout standard.
- Il PDF esce senza immagini (restano in HTML e JSON). Il tasto L per la prova di collegamento è solo un suggerimento: i collegamenti si creano dalle maniglie o con "Collega".

## Da fare

- Prova d'uso estesa con un progetto reale; primo rilascio di prova per verificare l'aggiornamento.
- Responsive di Playtest, Documenti, Catalogo, Validazione.
- Export/import delle impostazioni dell'app tra versioni (l'origine di localStorage cambia).
