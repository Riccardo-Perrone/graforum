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
| `npx vitest run` | Test (`src/**/*.test.ts`): modello, migrazioni, motore, export, file `.dng`, layout del dock |
| `npm run build && npm run smoke` | Prova nell'app vera (Electron su `out/`): grafo, gruppi, dock, finestre modali, overflow a 260px |
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
  lib/         commands.ts + shortcuts.ts (scorciatoie), entities.tsx, sceneOps.ts, fileActions.ts
  dock/        schede agganciabili (vedi sotto)
  components/  ui (primitive), graph, scene, catalog, logic, search, cross, validation, export, settings, shell
  screens/     Home, SheetHost, e i corpi delle schede Dialoghi, Documenti, Playtest
```

- **Alias:** `@shared` → `src/shared`, `@renderer` → `src/renderer/src`.
- **Logica nel posto giusto:** valutazione, validazione, indici, descrizioni stanno in `src/shared/engine` con test; la UI le richiama senza duplicarle.
- **Il main non conosce lo stato dell'app:** tiene solo le immagini del progetto aperto (in memoria, finiscono nel `.dng` al salvataggio) e risponde agli IPC.

## Convenzioni

- Interfaccia e commenti in italiano, commenti brevi.
- Id prefissati: `newId('scene')` → `scn_xxxxxxxxxx`. Il progetto di esempio usa id leggibili fissi (es. `scn_cantina`).
- Le modifiche al progetto passano solo da `useProjectStore().apply(etichetta, bozza => …, mergeKey?)`. Gli helper di `lib/entities.tsx` (`apply`, `useProject`, `options`) lo avvolgono.
- Nuove impostazioni dell'app in `Prefs` (`store/ui.ts`, localStorage `graforum.prefs`), lette e scritte con `setPrefs`. Prefs attuali: `theme`, `uiScale`, `textScale`, `snap`, `shortcuts`, `autoCheckUpdates`, `layout`.
- Stile: misure del README di handoff (controlli 28–32px, etichette di categoria mono 10px maiuscolo, sezioni numerate "01 · ETICHETTA"). Token colore: `tx/tx2/tx3`, `ac`, `safe`, `warn`, `err`, `line/line2`, `raised/sunken/panel/hover`.
- Layout responsive: righe con `flex-wrap`, `min-w-0` e `basis-*` al posto di larghezze fisse (un `flex-1` in una riga che va a capo ha bisogno di `basis-1`, una riga `flex-col` con wrap va in `flex-nowrap`).

## Stato per area

### Modello e file
- Schemi in `src/shared/model`; indice inverso "Usato in" (`buildUsageIndex`); `createEmptyProject`.
- `.dng` = zip con `project.json` + `images/`; scrittura atomica con `.bak`; autosalvataggio dopo 2 s dall'ultima modifica, solo se il progetto ha già un file. Recenti in localStorage (`graforum.recent`, 8 voci). Immagini lette come `graforum-img://lib/<id>`.
- **Versioni:** `SCHEMA_VERSION` = 1, nessuna migrazione ancora. `migrate.ts` + regola in `.claude/rules/modello-dati.md` (si carica solo toccando i file del modello): leggere sempre i file vecchi, copia `nome.dng.v<N>.bak` prima di riscrivere un file migrato.

### Motore (`src/shared/engine`)
Descrizioni in parole (`describe`), valutazione per il playtest con avanzamento automatico degli step (`evaluate`), transizioni, raggiungibilità e percorso decisivo (`graph`), fonti dei requisiti (`sources`), validazione (`validate`: partenza mancante, scene irraggiungibili, vicoli ciechi, Warning senza incontro, incontri senza enemy, gruppi senza entrata/uscita, finali incompleti, riferimenti a entità eliminate, requisiti senza fonte), elenco "Avanzamento" (`progress`), elenco dialoghi (`dialogList`).

### Canvas (`components/graph`)
Nodi scena, archi "floating" con scostamento per andata/ritorno, gruppi annidati e collassabili, minimappa, snap stile Figma (`snap.ts`, Alt lo sospende), selezione multipla (riquadro col sinistro, vista col centrale), menu contestuale, trascinamento dal catalogo. Un gruppo si trascina dall'etichetta; tenendo scene ~1 s sull'area di un gruppo le si aggiunge. Il clic su un gruppo lo seleziona e apre la scheda "Scheda". Scena: copertina stile Trello, etichette personalizzate, tag nascondibile.

### Dock di schede (`src/renderer/src/dock`)
- `dockview-react`; il grafo è al centro, aree sinistra/destra/basso sono *edge group* comprimibili. Schede (`panelList.ts`): `graph`, `inspector` ("Scheda": scena o gruppo secondo la selezione), `catalog`, `validation`, `playtest`, `dialogs`, `documents`. `PANEL_AREA` dice solo dove nasce una scheda nel layout standard; poi si sposta ovunque.
- **Aprire una scheda:** `useUiStore().setView(...)`, `openEntity(...)` o `dockBridge.openPanel(id, params)` (`bridge.ts`, compilato da `DockHost`). Toglie un ingrandimento, espande l'area compressa, attiva la scheda; se chiusa la riapre nel centro. I menu Vista/Finestra aprono sempre; i `toggle…` e il pulsante Validazione chiudono solo se la scheda è già in vista. Il bridge non ha import, per evitare cicli con lo store.
- **Dialoghi:** elenco ed editor sono la stessa scheda (`dialogs`; il parametro `dialogId` apre il dialogo, senza torna l'elenco). Non esistono pulsanti "Torna al grafo".
- **Ingrandisci** (`maximize.ts`, Ctrl+Spazio): chiude le aree laterali e porta al centro, finché dura, una scheda che stava in un'area (dockview non ingrandisce gli edge group).
- **Staccare** (`popout.ts`): `addPopoutGroup` + `window.open('/popout.html')`; stesso contesto JS, quindi store condivisi. Una scheda di un'area laterale passa prima al centro (dockview non stacca gli edge group). Tema e scala del testo si copiano nella finestra; le scorciatoie vi sono attaccate con `addShortcutWindow`.
- **Layout** salvato in `Prefs.layout` (validato da `isUsableLayout`; se non vale, layout standard); pulsante "Layout standard" in alto a destra (`resetLayout`); menu ⋯ su ogni gruppo (`PanelMenu.tsx`) per aprire qualsiasi scheda in quel gruppo; menu Finestra; comandi nel gruppo "Layout".
- `window.graforumDock` espone l'API di dockview alle prove automatiche.

### Scheda scena e gruppo
`components/scene/SceneSheet.tsx` e `GroupSheet.tsx` hanno due forme: **scheda del dock** (`DockedScenePanel`, `DockedGroupPanel`, dentro `inspector`) e **finestra modale al centro** (`SceneSheet` 1120×944, `GroupSheet` 760×760, gestite da `SheetHost` con `ui.sheet`). Dalla scheda un pulsante "Apri in una finestra al centro" (anche nel menu contestuale), dalla finestra "Aggancia al dock". Tutto il resto (catalogo, impostazioni, immagini, viste incrociate, esportazione) è solo modale. Elimina con `DangerButton` + conferma.

### Dialoghi, Playtest, Documenti
- **Dialoghi:** editor a grafo con battute e scelte (`DialogEditor`), "Prova dialogo" (`DialogRunner`), elenco con filtri e raggruppamento.
- **Playtest** (`PlaytestView`, riparte da `params.nonce`): percorso, incontri Vinto/Fuga/Sconfitta, dialoghi con stato condiviso, negozio, raccolta, prove con esito manuale, inventario/quest/flag modificabili, preset, Indietro/Ricomincia, salto a una scena, "Mostra nel grafo". Barre laterali di larghezza fissa (300/400px).
- **Documenti** (`DocumentsView`): CodeMirror, completamento con `@`, struttura, anteprima con chip, scheda in miniatura al passaggio del mouse, clic che apre l'entità.

### Catalogo, ricerca, viste, validazione, export
- Catalogo con schede NPC/enemy/oggetto/quest (fonti collegate, "Usato in"), libreria immagini.
- Ricerca Ctrl+K, filtri con viste salvate, selettore Percorso. Viste incrociate (`CrossViews`): dove serve un oggetto, quest nel grafo, NPC, enemy, avanzamento filtrabile con evidenziazione nel grafo.
- Pannello validazione con correzioni rapide (`highlight` nello store attenua il resto del grafo).
- Export JSON (senza dati solo-editor), HTML e PDF (senza immagini), zip con immagini; ambito tutto/gruppo/cataloghi; blocco per errori nell'ambito. Import JSON da File › Importa (passa da `migrateProject`).

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
