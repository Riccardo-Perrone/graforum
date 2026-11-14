// Prova della scheda Libreria: player solo nei suoni, caricamento mp3 e riproduzione, cartelle, trascinamento, viste, salvataggio.
// Uso: npm run build && npx electron scripts/smoke-library.cjs   — esce con codice 1 se qualcosa non funziona.
const { app, BrowserWindow, dialog } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.resolve(__dirname, '..')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graforum-lib-'))

// Un mp3 valido fatto di fotogrammi di silenzio (MPEG1 Layer III, 128 kbps, 44,1 kHz): ~2,6 s.
const frame = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413)])
const mp3 = path.join(tmp, 'prova.mp3')
fs.writeFileSync(mp3, Buffer.concat(Array.from({ length: 100 }, () => frame)))
const png = path.join(tmp, 'pixel.png')
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
const dng = path.join(tmp, 'prova.dng')
// Un png grande (800x600) per provare le miniature.
const zlib = require('zlib')
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(t)); return Buffer.concat([len, t, crc]) }
function bigPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (x * 255) / w; raw[o + 1] = (y * 255) / h; raw[o + 2] = (x * y) & 255 }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const big = path.join(tmp, 'grande.png')
fs.writeFileSync(big, bigPng(800, 600))
const files = { MP3: mp3, PNG: png, BIG: big }

// Il dialogo di apertura file è sostituito: la pagina dice quale file "scegliere" (window.__pick).
dialog.showOpenDialog = async () => {
  const win = BrowserWindow.getAllWindows()[0]
  const k = await win.webContents.executeJavaScript('window.__pick')
  return { canceled: false, filePaths: (k || []).map((x) => files[x]) }
}
require(path.join(root, 'out/main/index.js'))

const PAGE_TEST = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const fails = []
  const check = (ok, msg) => { if (!ok) fails.push(msg) }
  const stores = window.graforumStores
  const proj = () => stores.project.getState().project
  const q = (sel) => [...document.querySelectorAll(sel)]
  const btn = (re) => q('button').find((b) => re.test(b.textContent.trim()) || re.test(b.title || ''))
  const nativeSet = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  const drag = async (from, to) => {
    const dt = new DataTransfer()
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    await sleep(300)
  }
  const player = () => document.querySelector('[data-testid=player]')
  const row = () => q('[data-testid=media-item]')[0]
  const node = (name) => q('[data-testid=folder-node]').find((n) => n.textContent.startsWith(name))
  const newFolder = async (name) => {
    btn(/^Nuova cartella/).click(); await sleep(200)
    const input = document.querySelector('input[aria-label="Nome della nuova cartella"]')
    nativeSet(input, name); key(input, 'Enter'); await sleep(300)
  }

  // 1. Apertura e player: visibile solo in Suoni.
  stores.ui.getState().setView({ kind: 'library', tab: 'images' })
  await sleep(700)
  check(!!btn(/^Media/), 'scheda Libreria non aperta')
  check(!player(), 'il player è visibile nella sezione Immagini')
  btn(/^Suoni/).click(); await sleep(300)
  check(!!player(), 'il player non è visibile nella sezione Suoni')
  btn(/^Media/).click(); await sleep(300)
  check(!player(), 'il player resta visibile tornando a Immagini')
  btn(/^Suoni/).click(); await sleep(300)

  // 2. Caricamento di un mp3 e riproduzione senza errori.
  window.__pick = ['MP3']
  document.querySelector('[data-testid=library-upload]').click(); await sleep(800)
  check(proj().sounds.length === 1 && proj().sounds[0].mime === 'audio/mpeg', 'l mp3 non è entrato in libreria')
  check(!!row(), 'il suono non compare nell elenco')
  stores.ui.getState().setPrefs({ libraryView: 'list' }); await sleep(250)
  row()?.querySelector('button[title=Ascolta]')?.click()
  await sleep(1200)
  check(!player().textContent.includes('non riproducibile'), 'il player segnala file non riproducibile')
  const t = [...player().querySelectorAll('span')].map((s) => s.textContent).filter((s) => /^\\d+:\\d\\d$/.test(s))
  check(t.length === 2 && t[1] !== '0:00', 'la durata del suono non viene letta (' + t.join('/') + ')')
  await sleep(800)
  const t2 = [...player().querySelectorAll('span')].map((s) => s.textContent).filter((s) => /^\d+:\d\d$/.test(s))
  check(t2[0] !== '0:00', 'il suono non avanza (' + t.join('/') + ' poi ' + t2.join('/') + ')')
  check(!!player().querySelector('button[title^="Pausa"]'), 'il pulsante non passa a Pausa')
  q('button[title=Ferma]')[0].click(); await sleep(200)

  // 3. Cartelle: crea, annida, sposta con il trascinamento, rinomina.
  await newFolder('Musica')
  check(proj().soundFolders.includes('Musica'), 'cartella Musica non creata')
  await newFolder('Taverna')
  check(proj().soundFolders.includes('Musica/Taverna'), 'sottocartella annidata non creata: ' + JSON.stringify(proj().soundFolders))
  btn(/^sound$/).click(); await sleep(200)
  await drag(row(), node('Musica'))
  check(proj().sounds[0].folder === 'Musica', 'trascinando il suono su Musica non si sposta: "' + proj().sounds[0].folder + '"')
  check(q('[data-testid=media-item]').length === 0, 'il suono resta visibile nella radice dopo lo spostamento')
  node('Musica').click(); await sleep(200)
  check(q('[data-testid=media-item]').length === 1, 'il suono non compare nella cartella Musica')
  await drag(row(), node('Taverna'))
  check(proj().sounds[0].folder === 'Musica/Taverna', 'spostamento in sottocartella fallito')
  await drag(node('Taverna'), node('sound'))
  check(proj().sounds[0].folder === 'Taverna' && proj().soundFolders.includes('Taverna'), 'spostare la cartella non porta il file: ' + proj().sounds[0].folder)
  await drag(node('Taverna'), node('Musica'))
  check(proj().sounds[0].folder === 'Musica/Taverna', 'riportare la cartella dentro Musica fallito')
  node('Musica').click(); await sleep(200)
  q('button[title="Rinomina cartella"]')[0].click(); await sleep(200)
  let input = document.querySelector('input[aria-label="Nuovo nome"]')
  nativeSet(input, 'Ambiente'); key(input, 'Enter'); await sleep(300)
  check(proj().sounds[0].folder === 'Ambiente/Taverna', 'rinomina: il file non segue la cartella: ' + proj().sounds[0].folder)
  btn(/^Nuova cartella/).click(); await sleep(200)
  input = document.querySelector('input[aria-label="Nome della nuova cartella"]')
  nativeSet(input, 'a/b?'); key(input, 'Enter'); await sleep(300)
  check(!proj().soundFolders.some((f) => f.includes('?')), 'creata una cartella con nome non valido')
  key(input, 'Escape'); await sleep(200)

  // 4. Viste: elenco, icone piccole, icone grandi.
  for (const v of ['list', 'small', 'large']) {
    stores.ui.getState().setPrefs({ libraryView: v }); await sleep(250)
    check(q('[data-testid=folder-tile]').length > 0, 'vista ' + v + ': le cartelle non compaiono')
  }
  stores.ui.getState().setPrefs({ libraryView: 'list' }); await sleep(250)
  const seg = q('[data-testid=view-switch] button')
  check(seg.length === 3, 'selettore di vista: attesi 3 pulsanti, trovati ' + seg.length)
  seg[2]?.click(); await sleep(250)
  check(stores.ui.getState().libraryView === 'large', 'il selettore non passa alla vista icone grandi')

  // 5. Salvataggio: le cartelle sono vere dentro il .dng.
  const res = await window.graforum.saveProject(proj(), window.__dng)
  check(res.ok, 'salvataggio fallito')

  // 6. Immagini: stesse cartelle, nessun player.
  btn(/^Media/).click(); await sleep(300)
  check(!player(), 'player visibile in Immagini (2)')
  window.__pick = ['PNG']
  document.querySelector('[data-testid=library-upload]').click(); await sleep(800)
  check(proj().images.length === 1, 'immagine non caricata')
  await newFolder('Mappe')
  btn(/^media$/).click(); await sleep(200)
  await drag(row(), node('Mappe'))
  check(proj().images[0].folder === 'Mappe', 'immagine non spostata in Mappe')

  // 6b. Miniature: un png grande ha una miniatura di 400 px, salvata nel .dng; una piccola resta com'è.
  window.__pick = ['BIG']
  document.querySelector('[data-testid=library-upload]').click(); await sleep(900)
  check(proj().images.length === 2, 'il png grande non è entrato in libreria')
  const bigImg = proj().images[1]
  const dims = (url) => new Promise((r) => { const im = new Image(); im.onload = () => r([im.naturalWidth, im.naturalHeight]); im.onerror = () => r(null); im.src = url })
  const th = await dims('graforum-img://thumb/' + bigImg.id)
  check(th && th[0] === 400 && th[1] === 300, 'la miniatura non è di 400x300: ' + JSON.stringify(th))
  const full = await dims('graforum-img://lib/' + bigImg.id)
  check(full && full[0] === 800, 'l originale non resta a 800 px: ' + JSON.stringify(full))
  const small = await dims('graforum-img://thumb/' + proj().images[0].id)
  check(small && small[0] === 1, 'un immagine già piccola deve usare l originale: ' + JSON.stringify(small))
  check(q('[data-testid=media-item] img').some((im) => im.src.includes('/thumb/')), 'la Libreria non mostra le miniature')
  window.__bigId = bigImg.id
  const res2 = await window.graforum.saveProject(proj(), window.__dng)
  check(res2.ok, 'secondo salvataggio fallito')

  // 6c. Albero delle cartelle collassabile; Nuova cartella e comprimi stanno in cima all albero.
  const bar = document.querySelector('[data-testid=tree-toggle]').parentElement
  check(bar.contains(document.querySelector('[data-testid=new-folder]')), 'Nuova cartella non sta accanto al pulsante di compressione')
  check(q('[data-testid=folder-node]').length > 0, 'albero non visibile all inizio')
  document.querySelector('[data-testid=tree-toggle]').click(); await sleep(250)
  check(q('[data-testid=folder-node]').length === 0, 'l albero non si nasconde')
  check(!!document.querySelector('[data-testid=new-folder]'), 'con l albero compresso sparisce Nuova cartella')
  document.querySelector('[data-testid=tree-toggle]').click(); await sleep(250)
  check(q('[data-testid=folder-node]').length > 0, 'l albero non si riapre')
  check(!q('button').some((b) => /Esplora/.test(b.textContent + b.title)), 'è rimasto un riferimento a Esplora risorse')
  btn(/^media$/).click(); await sleep(200)
  // 7. Dalla scena: carica un suono e lo associa.
  const scn = proj().scenes[0]
  stores.ui.getState().setSelection([scn.id]); await sleep(600)
  const up = q('button').find((b) => /^Carica$/.test(b.textContent.trim()))
  check(!!up, 'pulsante Carica non presente nella scheda scena')
  if (up) {
    window.__pick = ['MP3']; up.click(); await sleep(900)
    check(proj().sounds.length === 2 && proj().scenes[0].soundIds.length === 1, 'il suono caricato dalla scena non viene associato')
  }
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
  await win.webContents.executeJavaScript(`window.__dng = ${JSON.stringify(dng)}`)
  const fails = await win.webContents.executeJavaScript(PAGE_TEST)
  // Controllo del file salvato: cartelle reali dentro lo zip.
  try {
    const { unzipSync } = require('fflate')
    const names = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(dng))))
    if (!names.some((n) => /^thumbs\/img_.+\.png$/.test(n))) fails.push('il .dng non contiene la miniatura in thumbs/: ' + names.join(', '))
    if (!names.some((n) => /^sound\/Ambiente\/Taverna\/snd_.+\.mp3$/.test(n))) fails.push('il .dng non contiene il suono in sound/Ambiente/Taverna: ' + names.join(', '))
  } catch (e) {
    fails.push('lettura del .dng: ' + e.message)
  }
  console.log(fails.length ? 'FALLITO:\n- ' + fails.join('\n- ') : 'OK: libreria, player, cartelle, viste, miniature')
  fs.rmSync(tmp, { recursive: true, force: true })
  app.exit(fails.length ? 1 : 0)
})
