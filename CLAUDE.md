# Graforum – istruzioni per l'agente

Editor di grafi narrativi D&D (Electron + React + TypeScript). Prima di lavorare leggi `docs/sviluppo.md` (stato e convenzioni) e `docs/modello-dati-v3.md` (decisioni sul modello). L'utente scrive in italiano: rispondi, e scrivi interfaccia e commenti, in italiano.

## Istruzioni obbligatorie

- **Ogni nuovo comando deve poter essere modificato tra le scorciatoie.** Un'azione che si può fare da tastiera (o che merita una scorciatoia) si registra in `src/renderer/src/lib/commands.ts` (`COMMANDS`: id, etichetta, gruppo, ambito, combinazione predefinita anche vuota) e si collega con `useCommand('id', handler)` da `lib/shortcuts.ts`. Non usare `useShortcut('ctrl+x', …)` con combinazioni scritte nel codice, né controlli diretti su `e.key`.
- Le combinazioni mostrate in menu, pulsanti e testi di aiuto vengono da `useKbd('id')` / `kbdLabel('id')`, mai da stringhe fisse come "Ctrl S".
- Le scorciatoie personalizzate si salvano con le altre preferenze dell'app (`Prefs.shortcuts` in `store/ui.ts`, localStorage). Ogni nuova impostazione dell'app va in `Prefs` e si legge/scrive con `setPrefs`, così persiste.
- Il pulsante di eliminazione di scene, battute e scelte usa `DangerButton` (`components/ui/primitives.tsx`) e chiede sempre conferma prima di cancellare.
- Le modifiche al progetto passano solo da `useProjectStore().apply(...)` (annullabili).
- Se tocchi il canvas (nodi, gruppi, trascinamento, selezione) esegui anche `npm run build && npm run smoke`: verifica che i gruppi interni restino selezionabili, collassabili e trascinabili. Aggiungi un controllo a `scripts/smoke.cjs` per ogni nuova interazione del grafo.
- Dopo le modifiche: `npx tsc -p tsconfig.web.json --noEmit` e `npx vitest run` devono passare.
