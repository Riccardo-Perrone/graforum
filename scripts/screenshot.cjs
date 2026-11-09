// Verifica visiva: avvia l'app compilata (out/), esegue dei passi nella pagina e salva screenshot.
// Uso: electron scripts/screenshot.cjs <cartellaOutput> <passi.json>
// passi.json: [{ "js": "codice da eseguire nella pagina", "wait": 500, "shot": "nome.png", "win": "popout" }, ...]  (win: parte dell'indirizzo della finestra da fotografare, es. una scheda staccata)
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const [outDir, stepsFile] = process.argv.slice(-2)
const root = path.resolve(__dirname, '..')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Il processo principale vero: registra protocollo immagini, IPC e crea la finestra.
require(path.join(root, 'out/main/index.js'))

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await wait(50)
  // Fuori dallo schermo, così la verifica non disturba.
  win.setBounds({ x: -4000, y: 0, width: 1920, height: 1080 })
  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()))
  const errors = []
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 3) errors.push(e.message)
  })
  const prepare = 'window.confirm = () => true; window.alert = () => {}; window.prompt = (_m, d) => d ?? "Prova"; 0'
  await win.webContents.executeJavaScript(`localStorage.clear(); ${prepare}`)
  win.webContents.reload()
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await wait(800)
  await win.webContents.executeJavaScript(prepare)
  const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'))
  fs.mkdirSync(outDir, { recursive: true })
  for (const step of steps) {
    if (step.js) {
      try {
        await win.webContents.executeJavaScript(`${step.js}\n;0`)
      } catch (err) {
        errors.push(`passo "${step.js.slice(0, 80)}": ${err.message}`)
      }
    }
    await wait(step.wait ?? 400)
    if (step.shot) {
      const target = step.win === undefined ? win : BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes(step.win)) ?? win
      // Una finestra mai disegnata (nascosta, coperta) non risponde a capturePage: dopo 5 s si passa oltre.
      const image = await Promise.race([target.webContents.capturePage(), wait(5000).then(() => null)])
      if (image) fs.writeFileSync(path.join(outDir, step.shot), image.toPNG())
      else errors.push(`schermata "${step.shot}" non disponibile`)
    }
  }
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n'))
  app.exit(0)
})
