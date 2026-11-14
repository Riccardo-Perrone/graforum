# Modello dei dati v3 – Editor di grafo narrativo D&D

20 ottobre 2026. Sostituisce il §9 dei "Requisiti funzionali v2" dove differisce. Raccoglie le decisioni prese dopo la revisione del design (Claude Design, progetto "Editor grafo narrativo").

Il codice di riferimento è `src/shared/model/` (schemi Zod): questo documento ne è la descrizione funzionale e raccoglie le **decisioni** (il perché). Se codice e documento differiscono, vale il codice: correggi il documento. Tutto ciò che descrive è implementato; stato dell'app e architettura sono in `docs/sviluppo.md`.

## 0. Decisioni che cambiano i requisiti v2

| # | Decisione |
| --- | --- |
| 1 | Esistono i **flag** (sì/no) come nel design: effetto "Imposta flag", condizione sul flag, pannello Flag nel playtest. |
| 2 | Il **denaro è un oggetto** del catalogo con quantità. Le impostazioni indicano quale oggetto fa da valuta. |
| 3 | Nuovi tipi di condizione: incontro concluso con esito, scelta specifica di un dialogo, flag. In più l'utente può definire **tipi di condizione custom**. |
| 4 | Gli step di quest hanno un elenco di **requisiti** (condizioni). Il legame con chi li soddisfa è **automatico**: nella quest si vedono i requisiti e le fonti, nella fonte (es. il dialogo) si vede quale step soddisfa. |
| 5 | Ogni esito di un incontro (Vinto, Fuga, Sconfitta) ha destinazione ed effetti propri. |
| 6 | Ogni condizione di visibilità/accesso ha il comportamento "se non soddisfatta": **nascosto** oppure **visibile ma bloccato** con messaggio. Vale ovunque. |
| 7 | Gli skill check non hanno il flag "ritentabile". |
| 8 | L'editor di testo diventa **Documenti di progetto**: file Markdown liberi, collegati al progetto, con link alle entità. I documenti compaiono in "Usato in". |
| 9 | Schede NPC ed enemy con tutti i campi del modello standard, nello stile del design. |
| 10 | Oggetto: campi "impilabile" e "consumabile". |
| 11 | Il **negozio sta nell'NPC** (Servizi: merce, prezzo, scorta). Gli "oggetti presenti" della scena servono per casse e ritrovamenti. |
| 12 | Progetto in un **unico file `.dng`**. Il progetto di esempio "La locanda del Corvo" è incluso nell'app. |
| 13 | Impostazioni dell'app: **scala dell'interfaccia** e **dimensione del testo**, indipendenti dallo zoom del canvas. |
| 14 | Le fasi di implementazione sono state riordinate per dipendenza (sezione 9, ora completata). |
| 15 | I gruppi hanno **più scene di entrata e più scene di uscita**. |
| – | Export JSON "normale", non adattato a un motore specifico. |

## 1. Identificatori e riferimenti

- Ogni entità ha un `id` stabile: prefisso di tipo + 10 caratteri casuali (es. `scn_V1StGXR8Z5`). Non cambia mai, nemmeno rinominando.
- Prefissi: `scn` scena, `lnk` collegamento, `grp` gruppo, `end` finale, `prj` progetto, `lbl` etichetta di scena, `npc`, `eny` enemy, `itm` oggetto, `qst` quest, `stp` step, `dlg` dialogo, `dln` battuta, `dch` scelta, `enc` incontro, `img` immagine, `snd` suono, `flg` flag, `chk` skill check, `sit` oggetto in scena, `doc` documento, `pre` preset, `ctp` tipo di condizione custom, `skl` abilità, `ityp` tipo di oggetto, `cfd` campo custom.
- Un riferimento generico è `{ type, id }` (es. `{ "type": "scene", "id": "scn_…" }`).
- **Eliminazione:** bloccata se l'entità è usata; si mostra l'elenco "Usato in". Eliminando una scena spariscono anche i suoi collegamenti, il suo finale e gli incontri che non stanno in altre scene; se uno di questi è usato altrove l'eliminazione si blocca.

## 2. Progetto e file

| Campo | Tipo | Note |
| --- | --- | --- |
| schemaVersion | numero | Numero del formato; un file più recente dell'app si rifiuta |
| id, name, description | testo | |
| startSceneId | rif. scena | Obbligatoria per la validazione |
| settings | oggetto | Sezione 7 |
| scenes, links, groups, endings, encounters | elenchi | |
| npcs, enemies, items, quests, dialogs | elenchi | Cataloghi |
| images, sounds, flags, documents, presets | elenchi | |

**File `.dng`** = archivio zip con `project.json`, `media/` e `sound/` (con le sottocartelle della libreria). Il salvataggio è atomico (file temporaneo + rinomina) e mantiene una copia `.bak`. L'autosalvataggio scrive allo stesso modo.

**Versione del formato.** Esiste un solo formato: nessun progetto precedente va mantenuto leggibile, quindi non ci sono migrazioni. `schemaVersion` (costante `SCHEMA_VERSION` in `src/shared/model/project.ts`) si scrive nel file; all'apertura (file `.dng` e import JSON) `loadProject` (`model/load.ts`) rifiuta con un errore chiaro un file più recente dell'app, senza toccarlo, e valida il resto con lo schema. Se un giorno ci saranno file in circolazione da proteggere, qui andranno reintrodotte le migrazioni.

Le preferenze dell'app (tema, scala interfaccia, dimensione testo, aggancio dei nodi, scorciatoie, ricerca automatica degli aggiornamenti, disposizione delle schede, progetti recenti) non stanno nel progetto ma nel browser storage dell'app (localStorage).

## 3. Comportamenti riusabili

### Condizione

Albero di gruppi e foglie.

- **Gruppo:** `op` = E / O, `children` = condizioni o altri gruppi.
- **Foglie:**

| Tipo | Parametri |
| --- | --- |
| possiede oggetto | oggetto, quantità minima (il denaro è un oggetto) |
| stato quest | quest, step opzionale, stato: non iniziata / in corso / completata |
| dialogo completato | dialogo |
| scelta di dialogo fatta | dialogo, scelta |
| ha parlato con NPC | NPC |
| esito incontro | incontro, esito: vinto / fuga / sconfitta / uno qualsiasi |
| flag | flag, valore |
| skill check superato | elenco di skill check (basta uno: prove alternative) |
| scena visitata | scena |
| custom (tipo definito) | tipo di condizione custom + valori dei suoi parametri |
| personalizzata | testo libero + riferimento opzionale a un'entità |

### Gate (visibilità/accesso)

`{ condition, whenUnmet: hidden | locked, lockedMessage }`. Si usa su scene (`access`), collegamenti, scelte di dialogo, oggetti in scena, presenze degli NPC nelle scene, dialoghi assegnati agli NPC e merce dei negozi.

### Effetto

| Tipo | Parametri |
| --- | --- |
| ottiene / perde oggetto | oggetto, quantità |
| avvia / avanza / completa quest | quest, step opzionale |
| sblocca / blocca | riferimento a scena o collegamento |
| imposta flag | flag, valore |
| personalizzato | testo libero |

### Skill check

`{ id, skillId, dc, success: Esito, failure: Esito }`, dove Esito = `{ target (rif. scena o battuta, opzionale), effects }`.

### Eventi automatici

Durante il playtest (e per l'export) alcune cose diventano fatti senza bisogno di un effetto: dialogo completato, scelta fatta, NPC con cui si è parlato, esito di un incontro, skill check superato, scena visitata.

## 4. Grafo

### Scena

| Campo | Tipo | Note |
| --- | --- | --- |
| title | testo | Obbligatorio |
| description | testo lungo | |
| imageId | rif. immagine | Una sola |
| soundIds | rif. suoni | Musica o ambiente della scena, da ascoltare dal player |
| tag | neutral / safe / warning | |
| tagHidden | sì/no | Nasconde il chip del tag sul nodo del grafo |
| labelIds | rif. etichette | Etichette personalizzate di scena, definite nelle impostazioni (§7) |
| cover | oggetto, opzionale | Copertina stile Trello: immagine e/o colore, `strip` (fascia) o `full` (intera) |
| groupId | rif. gruppo | Opzionale |
| npcs | elenco di presenze | Presenza = NPC con il suo gate + dialoghi in ordine, ognuno con gate; vale il primo soddisfatto |
| items | elenco di oggetti in scena | Oggetto, quantità, gate, prove alternative opzionali (es. cassa: FOR 15 o DES 14) |
| encounterIds | rif. incontri | Solo Warning |
| access | gate | Opzionale |
| entryEffects | elenco effetti | |
| entryCheck | skill check | Opzionale; le destinazioni portano ad altre scene |
| position | x, y | Solo editor |

La scena di partenza è `project.startSceneId`; una scena è finale se un Finale la riferisce.

### Collegamento

`fromSceneId`, `toSceneId`, `label`, `bidirectional`, `gate`, `effects` (al passaggio), `checks` (prove alternative: con successo si va a `toSceneId` salvo destinazione diversa; il fallimento ha la sua destinazione).

### Gruppo

`name`, `description`, `parentId`, `entrySceneIds[]`, `exitSceneIds[]` (devono appartenere al gruppo o ai sottogruppi), `color`, `collapsed`.

### Finale

`sceneId`, `label`, `color` (tavolozza del design, `ENDING_COLORS`: i finali nuovi la usano a rotazione), `manualDecisive[]` (collegamenti o scelte segnati a mano, si sommano al calcolo automatico).

### Incontro

`name`, `enemies[]` (enemy + quantità), `nature` unico / ripetibile, `rewards` (XP + oggetti), `outcomes`: `win`, `flee`, `defeat`, ognuno `{ target scena opzionale, effects }`.

Un incontro esiste solo dentro le scene (`scene.encounterIds`): quando non è più in nessuna scena si elimina. La validazione segnala quelli rimasti senza scena da file precedenti.

## 5. Cataloghi

### Campi comuni NPC ed enemy

| Gruppo | Campi |
| --- | --- |
| Identità | nome, ritratto, descrizione, aspetto, personalità |
| Anagrafica | razza/specie, genere, età, allineamento |
| Ruolo | fazione, ruolo, tag |
| Background | background, segreti |
| Statistiche | livello o GS, PF, CA, velocità, taglia |
| Caratteristiche | FOR, DES, COS, INT, SAG, CAR |
| Abilità | abilità con bonus, tiri salvezza con bonus |
| Combattimento | attacchi (nome, bonus, danno, tipo, portata), resistenze, immunità, vulnerabilità |
| Speciali | incantesimi, tratti e abilità speciali (nome + testo) |
| Bottino | equipaggiamento, loot (oggetti), XP |
| Custom | campi custom |

- **NPC** in più: **servizi** = negozio (merce: oggetto, prezzo in quantità di valuta, scorta o illimitata, gate), locanda, addestramento (testo). I dialoghi dell'NPC sono quelli con `npcId` uguale.
- **Enemy** in più: tipo di creatura, ambiente tipico.

### Oggetto

nome, descrizione, immagine, tipo (elenco configurabile), peso, valore, impilabile, consumabile, tag, campi custom. "Come si ottiene" è calcolato.

### Quest

titolo, descrizione, ricompense (XP + oggetti), step ordinati.

Step = `{ id, title, description, requirements: condizione }`. Lo step si completa quando i requisiti sono soddisfatti. Restano disponibili anche gli effetti espliciti "avanza / completa".

**Collegamento automatico (decisione 4):** l'indice inverso associa ogni requisito alle fonti che possono soddisfarlo. Esempio:

- lo step 1 chiede "dialogo *Benvenuto* completato";
- nella quest si vede la fonte: "Dialogo Benvenuto · Oste Bruno";
- nel dialogo si vede "Completa: Il segreto della cantina › step 1".

Se un requisito non ha nessuna fonte, la validazione lo segnala.

### Dialogo

`npcId`, `title`, `startLineId` (battuta iniziale), `lines[]`.

- **Battuta:** `speaker` (`npc` = NPC proprietario, `player` = giocatore, `other` con `name`), `text`, `effects`, `choices[]`, `position`. Zero scelte = fine.
- **Scelta:** `text`, `targetLineId` (battuta di destinazione, oppure null = chiude il dialogo), `gate`, `effects`, `check` opzionale.

Un dialogo è "solo contesto" se non contiene effetti né prove: è calcolato, non salvato.

## 6. Libreria, flag, documenti, preset

- **Immagine:** `fileName`, `title`, `tags`, `mime`, `width`, `height`. Il file viene copiato nel `.dng`.
- **Suono:** `fileName`, `title`, `tags`, `mime`, `folder`. Il file viene copiato nel `.dng` sotto `sound/<folder>/<id>.<ext>`. Lo stesso vale per i media (`media/…`, con le miniature in `thumbs/<id>.jpg|png`). `folder` è un percorso "A/B" (vuoto = radice) che coincide con le cartelle dentro lo zip; `Project.imageFolders` / `soundFolders` elencano le cartelle (anche vuote) che compaiono come cartelle vere nello zip. I tag restano un'altra dimensione, indipendente dalle cartelle. Una scena li associa con `soundIds` (elenco, anche vuoto); un suono associato non si elimina finché è usato. Campi aggiunti con valore predefinito: i `.dng` precedenti si leggono senza migrazione.
- **Flag:** `name`, `description`, `defaultValue`.
- **Documento:** `title`, `markdown`, `order`.
  - I link alle entità usano la sintassi `@[Testo visibile](tipo:id)`, ad esempio `@[Oste Bruno](npc:npc_V1StGXR8Z5)`.
  - Rinominare l'entità non rompe il link.
  - Nell'anteprima, il passaggio del mouse mostra la scheda in miniatura e il clic la apre.
- **Preset di playtest:** `name`, oggetti con quantità, stati di quest e step, flag.

## 7. Impostazioni del progetto

abilità (nome + caratteristica), tipi di oggetto, oggetto valuta, definizioni dei campi custom per NPC/enemy/oggetto (nome, tipo: testo / numero / sì-no / scelta con opzioni), tipi di condizione custom (nome, parametri: nome + tipo di valore o tipo di entità), etichette di scena (nome + colore).

## 8. Export

- **JSON:** lo stesso modello del `project.json` senza i dati solo-editor (posizioni, stato collassato), con id stabili. Formato generico, non adattato a un motore.
- **HTML/PDF:** documento leggibile per il tavolo.
- **Ambiti:** tutto, un gruppo, solo cataloghi. Le immagini sono incluse nel pacchetto (zip).

## 9. Fasi di implementazione (completate)

1. **Fondamenta.**
   - Shell dell'app, Home e file `.dng`, con autosalvataggio e annulla/ripeti.
   - Modello completo e motore di condizioni ed effetti.
   - Impostazioni (con la scala dell'interfaccia).
   - Libreria immagini, cataloghi completi con "Usato in", editor condizioni.
   - Canvas con scene e collegamenti, scheda scena, editor dialoghi.
2. **Censimento intelligente.**
   - Gruppi annidati collassabili, incontri con esiti, skill check, requisiti degli step con collegamento automatico.
   - Ricerca e filtri, viste incrociate, validazione, campi e condizioni custom.
   - Documenti di progetto.
3. **Verifica ed export.**
   - Playtest con "Prova dialogo" e preset.
   - Percorso decisivo.
   - Export JSON, HTML e PDF; import JSON.

## 10. Assunzioni non ancora riconfermate dall'utente

- **Skill check all'ingresso della scena** (`entryCheck`): nei requisiti v2 era un esempio negli "effetti all'ingresso". È modellato come prova unica con due destinazioni.
- **Quest completa:** una quest si considera completata quando è completato l'ultimo step, salvo effetto esplicito "completa quest".
