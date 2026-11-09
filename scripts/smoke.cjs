// Prova di regressione del grafo e del dock delle schede (compilare prima: npm run build).
// Uso: npx electron scripts/smoke.cjs   — esce con codice 1 se qualcosa non funziona.
const { app, BrowserWindow } = require('electron')
const path = require('path')

const root = path.resolve(__dirname, '..')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
require(path.join(root, 'out/main/index.js'))

// Eseguito nella pagina: restituisce l'elenco degli errori trovati.
const PAGE_TEST = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const fails = []
  const check = (ok, msg) => { if (!ok) fails.push(msg) }
  const ev = (t, x, y, el) => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window, button: 0, buttons: t === 'mouseup' ? 0 : 1 }))
  const groups = () => [...document.querySelectorAll('.react-flow__node-sceneGroup')]
  const byName = (name) => groups().find((n) => n.textContent.includes(name))
  const sceneTf = (name) => [...document.querySelectorAll('.react-flow__node-scene')].find((n) => n.textContent.includes(name))?.style.transform
  const click = async (el) => { el.click(); await sleep(400) }

  // 1. Ogni etichetta di gruppo (anche annidato) deve ricevere il mouse, non essere coperta da altro.
  check(groups().length >= 2, 'servono almeno due gruppi nell esempio')
  for (const g of groups()) {
    const h = g.querySelector('.group-handle')
    const r = h.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    check(top && top.closest('.group-handle') === h, 'etichetta coperta: ' + g.textContent.slice(0, 30))
    check(getComputedStyle(h).cursor === 'grab', 'cursore grab mancante sull etichetta')
    const name = h.querySelectorAll('button')[1]
    check(getComputedStyle(name).cursor === 'pointer', 'cursore pointer mancante sul nome del gruppo')
  }

  // 2. Collassare ed espandere il gruppo interno.
  const inner = byName('Locanda')
  await click(inner.querySelector('button[title="Collassa"]'))
  check(document.querySelectorAll('.react-flow__node-collapsedGroup').length === 1, 'il gruppo interno non si collassa')
  const card = document.querySelector('.react-flow__node-collapsedGroup')
  await click(card.querySelector('button[title="Espandi"]'))
  check(document.querySelectorAll('.react-flow__node-collapsedGroup').length === 0, 'il gruppo interno non si espande')

  // 3. Trascinare il gruppo interno: sposta le sue scene, non quelle dell altro livello.
  const drag = async (name, dx, dy) => {
    const h = byName(name).querySelector('.group-handle')
    const r = h.getBoundingClientRect()
    const x = r.x + 8, y = r.y + r.height / 2
    ev('mousedown', x, y, h)
    for (let i = 1; i <= 8; i++) { ev('mousemove', x + dx * i / 8, y + dy * i / 8, window); await sleep(30) }
    check(document.body.classList.contains('is-dragging-group'), 'cursore di trascinamento gruppo non attivo')
    ev('mouseup', x + dx, y + dy, window)
    await sleep(500)
  }
  const inBefore = sceneTf('Sala comune'), outBefore = sceneTf('Piazza del villaggio')
  await drag('Locanda', 120, 40)
  check(sceneTf('Sala comune') !== inBefore, 'il gruppo interno non si sposta')
  check(sceneTf('Piazza del villaggio') === outBefore, 'spostando il gruppo interno si e mosso anche l esterno')
  const outBefore2 = sceneTf('Piazza del villaggio'), inBefore2 = sceneTf('Sala comune')
  await drag('Villaggio', 0, 80)
  check(sceneTf('Piazza del villaggio') !== outBefore2 && sceneTf('Sala comune') !== inBefore2, 'il gruppo esterno non porta con se tutto')

  // 4. Cursore di spostamento della vista col tasto centrale.
  window.dispatchEvent(new MouseEvent('mousedown', { button: 1 }))
  check(document.body.classList.contains('is-panning'), 'cursore di spostamento vista non attivo')
  window.dispatchEvent(new MouseEvent('mouseup', { button: 1 }))
  check(!document.body.classList.contains('is-panning'), 'cursore di spostamento vista non si disattiva')

  // 4b. Etichetta personalizzata e copertina intera dalla scheda scena: compaiono sul nodo.
  const node = () => [...document.querySelectorAll('.react-flow__node-scene')].find((n) => n.textContent.includes('Piazza del villaggio'))
  const btn = (txt, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === txt)
  node().dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }))
  await sleep(600)
  // La scheda della scena si apre nell'area sinistra del dock.
  // (con il rendering "always" il contenuto delle schede sta in un livello a parte, non dentro il gruppo)
  const inspector = () => window.graforumDock.getPanel('inspector')?.view.content.element
  const dlg = inspector()
  check(!!dlg, 'scheda della scena assente nel dock')
  check(!!btn('Aggiungi', dlg), 'scheda scena: manca il pulsante delle etichette')
  btn('Aggiungi', dlg)?.click()
  await sleep(200)
  const nameInput = dlg.querySelector('input[placeholder="Nome"]')
  check(!!nameInput, 'scheda scena: manca il campo nome etichetta')
  if (nameInput) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(nameInput, 'Misteriosa')
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(100)
    btn('Crea', dlg)?.click()
    await sleep(400)
    check(node().textContent.toUpperCase().includes('MISTERIOSA'), 'l etichetta non compare sul nodo')
  }
  btn('Intera', dlg)?.click()
  await sleep(400)
  check(node().querySelector('.absolute.inset-0.overflow-hidden') !== null, 'la copertina intera non compare sul nodo')
  btn('Parziale', dlg)?.click()
  await sleep(400)
  check(node().querySelector('.absolute.inset-0.overflow-hidden') === null && getComputedStyle(node().querySelector('.box-border')).backgroundColor !== 'rgba(0, 0, 0, 0)', 'la copertina parziale non compare sul nodo')
  // Il chip del tag in alto nella scheda nasconde/mostra il tag sul nodo.
  const tagBtn = () => dlg.querySelector('button[title*="tag" i]')
  const tagLabel = tagBtn()?.textContent.trim()
  check(!!tagLabel && node().textContent.includes(tagLabel), 'il tag non compare sul nodo')
  tagBtn()?.click()
  await sleep(300)
  check(!node().textContent.includes(tagLabel), 'il chip del tag non nasconde il tag sul nodo')
  check(!!tagBtn()?.querySelector('.stripes'), 'il chip del tag nascosto non ha le barre diagonali')
  tagBtn()?.click()
  await sleep(300)
  check(node().textContent.includes(tagLabel), 'il chip del tag non rimostra il tag sul nodo')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await sleep(300)

  // 5. Canc su una scena selezionata: chiede conferma e un secondo Canc la conferma.
  const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  const scenes = () => document.querySelectorAll('.react-flow__node-scene').length
  const pozzo = [...document.querySelectorAll('.react-flow__node-scene')].find((n) => n.textContent.includes('Pozzo abbandonato'))
  const before = scenes()
  pozzo.click()
  await sleep(300)
  key('Delete')
  await sleep(300)
  check(!!document.querySelector('[role="alertdialog"]'), 'Canc non chiede conferma')
  key('Delete')
  await sleep(500)
  check(!document.querySelector('[role="alertdialog"]'), 'il secondo Canc non chiude la conferma')
  check(scenes() === before - 1, 'il secondo Canc non elimina la scena')

  // 6. Il clic sul nome di un gruppo lo mostra nella scheda a sinistra.
  const nameBtn = byName('Locanda')?.querySelector('.group-handle').querySelectorAll('button')[1]
  nameBtn?.click()
  await sleep(500)
  const left = inspector()
  check(!!left && left.textContent.includes('Gruppo') && [...left.querySelectorAll('input')].some((i) => i.value.includes('Locanda')), 'il gruppo non compare nella scheda a sinistra')

  // 7. Dock: layout standard, spostamento, ingrandimento, collasso delle aree, ripristino, salvataggio.
  const dock = window.graforumDock
  const where = (id) => dock.getPanel(id)?.api.location.type
  check(where('graph') === 'grid' && where('inspector') === 'edge' && where('catalog') === 'edge', 'layout standard: grafo al centro, scheda e catalogo nelle aree laterali')
  dock.getPanel('catalog').api.moveTo({ group: dock.getPanel('graph').group, position: 'right' })
  await sleep(400)
  check(where('catalog') === 'grid', 'la scheda catalogo non si sposta al centro')
  document.querySelector('button[title^="Layout standard"]').click()
  await sleep(600)
  check(where('catalog') === 'edge' && dock.panels.length === 3, 'il pulsante Layout standard non ripristina il layout')
  const ctrlSpace = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', ctrlKey: true, bubbles: true, cancelable: true }))
  dock.getPanel('graph').api.setActive()
  ctrlSpace()
  await sleep(500)
  check(dock.hasMaximizedGroup() && ['left', 'right', 'bottom'].every((a) => dock.getEdgeGroup(a).isCollapsed()), 'Ctrl+Spazio non ingrandisce la scheda a tutta la finestra')
  ctrlSpace()
  await sleep(500)
  check(!dock.hasMaximizedGroup() && !dock.getEdgeGroup('left').isCollapsed() && !dock.getEdgeGroup('right').isCollapsed(), 'il ripristino non riapre le aree laterali')
  dock.getPanel('catalog').api.setActive()
  ctrlSpace()
  await sleep(500)
  check(dock.getPanel('catalog').api.isMaximized(), 'una scheda di un area laterale non si ingrandisce')
  ctrlSpace()
  await sleep(500)
  check(where('catalog') === 'edge', 'la scheda ingrandita non torna nella sua area')
  dock.getEdgeGroup('left').collapse()
  await sleep(300)
  check(dock.getEdgeGroup('left').isCollapsed(), 'l area sinistra non si comprime')
  dock.getEdgeGroup('left').expand()
  await sleep(300)
  const validationBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Validazione'))
  validationBtn.click()
  await sleep(500)
  check(where('validation') === 'grid', 'la validazione non si apre nel centro')
  await sleep(500)
  const saved = JSON.parse(localStorage.getItem('graforum.prefs') || '{}').layout
  check(!!saved && !!saved.panels && !!saved.panels.validation, 'il layout non viene salvato nelle preferenze')
  // 8. Una scheda chiusa con la X si riapre dal menu Finestra, nel centro; il menu "⋯" di un gruppo la apre in quel gruppo.
  dock.removePanel(dock.getPanel('catalog'))
  await sleep(300)
  check(!dock.getPanel('catalog'), 'la scheda catalogo non si chiude')
  const nav = [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === 'Finestra')
  nav.click()
  await sleep(200)
  ;[...document.querySelectorAll('nav button')].find((b) => b.textContent.includes('Catalogo')).click()
  await sleep(500)
  check(where('catalog') === 'grid' && dock.getPanel('catalog').group.id === dock.getPanel('graph').group.id, 'la scheda chiusa non si riapre nel centro dal menu Finestra')
  dock.removePanel(dock.getPanel('catalog'))
  await sleep(300)
  dock.getPanel('inspector').group.element.querySelector('button[title="Schede"]').click()
  await sleep(300)
  ;[...document.querySelectorAll('div.fixed button')].find((b) => b.textContent.includes('Catalogo')).click()
  await sleep(500)
  check(!!dock.getPanel('catalog') && dock.getPanel('catalog').group.id === dock.getPanel('inspector').group.id, 'il menu ⋯ non apre la scheda nel gruppo scelto')
  dock.getPanel('graph').group.element.querySelector('button[title="Schede"]').click()
  await sleep(300)
  ;[...document.querySelectorAll('div.fixed button')].find((b) => b.textContent.includes('Catalogo')).click()
  await sleep(500)
  check(dock.getPanel('catalog').group.id === dock.getPanel('graph').group.id, 'il menu ⋯ non sposta nel gruppo scelto una scheda aperta altrove')
  // 9. Dialoghi: un clic sull'elenco apre il dialogo nella stessa scheda, senza "Torna al grafo"; "Elenco dialoghi" riporta all'elenco.
  const txt = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent))
  nav.click()
  await sleep(150)
  ;[...document.querySelectorAll('nav button')].find((b) => b.textContent.includes('Dialoghi')).click()
  await sleep(500)
  const dialogsPanel = dock.getPanel('dialogs')
  check(!!dialogsPanel && dialogsPanel.api.isActive, 'il menu Vista non apre la scheda Dialoghi')
  const dlgEl = () => dock.getPanel('dialogs').view.content.element
  check(![...dlgEl().querySelectorAll('button')].some((b) => /Torna al grafo/.test(b.textContent)), 'l elenco dialoghi ha ancora Torna al grafo')
  const entry = [...dlgEl().querySelectorAll('div.cursor-pointer, button')].find((b) => b.textContent.includes('Benvenuto alla locanda'))
  check(!!entry, 'elenco dialoghi: voce non trovata')
  entry?.click()
  await sleep(600)
  check(dock.panels.filter((p) => p.id === 'dialogs').length === 1 && [...dlgEl().querySelectorAll('button')].some((b) => /Elenco dialoghi/.test(b.textContent)), 'il dialogo non si apre nella stessa scheda')
  ;[...dlgEl().querySelectorAll('button')].find((b) => /Elenco dialoghi/.test(b.textContent))?.click()
  await sleep(500)
  check(!![...dlgEl().querySelectorAll('div.cursor-pointer, button')].find((b) => b.textContent.includes('Benvenuto alla locanda')) && ![...dlgEl().querySelectorAll('button')].some((b) => /Elenco dialoghi/.test(b.textContent)), 'Elenco dialoghi non riporta all elenco')

  // 10. Aprire una scheda mentre un'altra è ingrandita la porta in vista.
  dock.getPanel('graph').api.setActive()
  ctrlSpace()
  await sleep(500)
  nav.click()
  await sleep(150)
  ;[...document.querySelectorAll('nav button')].find((b) => b.textContent.includes('Documenti')).click()
  await sleep(600)
  check(!dock.hasMaximizedGroup() && dock.getPanel('documents')?.api.isActive, 'con una scheda ingrandita, il menu non apre la scheda scelta')

  // 11. Scheda scena: modale al centro e ritorno al dock; nessuno scorrimento orizzontale a larghezze piccole.
  const scene = [...document.querySelectorAll('.react-flow__node-scene')].find((n) => n.textContent.includes('Cantina infestata'))
  scene.click()
  await sleep(400)
  const openModal = inspector().querySelector('button[title="Apri in una finestra al centro"]')
  check(!!openModal, 'manca il pulsante per aprire la scheda scena in finestra')
  openModal?.click()
  await sleep(500)
  const modal = document.querySelector('[data-sheet-level]')
  check(!!modal && [...modal.querySelectorAll('input')].some((i) => i.value === 'Cantina infestata'), 'la scheda scena non si apre nella finestra al centro')
  modal?.querySelector('button[title="Aggancia al dock"]')?.click()
  await sleep(400)
  check(!document.querySelector('[data-sheet-level]'), 'Aggancia al dock non chiude la finestra')
  dock.getEdgeGroup('left').setSize({ width: 260 })
  await sleep(400)
  const sc = inspector().querySelector('.overflow-y-auto')
  check(!!sc && sc.scrollWidth <= sc.clientWidth + 1, 'la scheda scena ha scorrimento orizzontale a larghezza ridotta (' + (sc && sc.scrollWidth + '>' + sc.clientWidth) + ')')
  return fails
})()`

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await wait(50)
  win.setBounds({ x: -4000, y: 0, width: 1920, height: 1080 })
  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()))
  await win.webContents.executeJavaScript('localStorage.clear()')
  win.webContents.reload()
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await wait(800)
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find((b) => b.textContent.includes('esempio')).click()")
  await wait(1500)
  const fails = await win.webContents.executeJavaScript(PAGE_TEST)
  console.log(fails.length ? 'FALLITO:\n- ' + fails.join('\n- ') : 'OK: grafo, gruppi e dock')
  app.exit(fails.length ? 1 : 0)
})
