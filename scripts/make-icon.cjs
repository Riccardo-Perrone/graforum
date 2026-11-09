// Genera l'icona dell'app: un grafo di dadi da D&D (d4, d6, d8, d12, d20) collegati, a matita.
// Uso: npx electron scripts/make-icon.cjs   →  build/icon.svg, build/icon.png (512), build/icon.ico (16–256)
const { app, BrowserWindow, nativeImage } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.disableHardwareAcceleration()

const OUT = join(__dirname, '..', 'build')
const INK = '#2c2a30'
const PAPER = '#efe6d0'

const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`
const poly = (pts) => pts.map(pt).join(' ')
/** Vertici di un poligono regolare con il primo in alto. */
const ngon = (cx, cy, r, n, rot = -90) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(((rot + (360 / n) * i) * Math.PI) / 180), cy + r * Math.sin(((rot + (360 / n) * i) * Math.PI) / 180)])
const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const line = (a, b) => `M${pt(a)} L${pt(b)}`

// Centri dei dadi (viewBox 512).
const C20 = [256, 262]
const C6 = [118, 126]
const C4 = [396, 124]
const C8 = [114, 400]
const C12 = [398, 402]

/** Ogni dado: contorno, linee interne e (facoltativo) una faccia ombreggiata a tratteggio. */
function dice() {
  // d20: esagono con triangolo interno rovesciato.
  const h = ngon(...C20, 92, 6)
  const t20 = [h[1], h[3], h[5]]
  const d20 = {
    outline: poly(h),
    inner: [line(mid(t20[2], t20[0]), h[0]), line(mid(t20[0], t20[1]), h[2]), line(mid(t20[1], t20[2]), h[4]), `M${poly(t20)} Z`].join(' '),
    hatch: poly(t20)
  }
  // d6: cubo in prospettiva.
  const c = ngon(...C6, 64, 6)
  const cube = {
    outline: poly(c),
    inner: [line(C6, c[1]), line(C6, c[5]), line(C6, c[3])].join(' '),
    hatch: poly([C6, c[1], c[2], c[3]])
  }
  // d4: triangolo con punto interno.
  const tr = ngon(...C4, 74, 3)
  const p4 = mid(mid(tr[1], tr[2]), tr[0], 0.34)
  const d4 = {
    outline: poly(tr),
    inner: [line(p4, tr[0]), line(p4, tr[1]), line(p4, tr[2])].join(' '),
    hatch: poly([p4, tr[1], tr[2]])
  }
  // d8: rombo con triangolo interno.
  const o = [
    [C8[0], C8[1] - 74],
    [C8[0] + 58, C8[1]],
    [C8[0], C8[1] + 74],
    [C8[0] - 58, C8[1]]
  ]
  const ctr = [C8[0], C8[1] + 6]
  const d8 = {
    outline: poly(o),
    inner: [line(o[3], o[1]), line(o[0], ctr), line(o[3], ctr), line(o[1], ctr)].join(' '),
    hatch: poly([o[3], o[1], o[2]])
  }
  // d12: pentagono con pentagono interno, vertici collegati uno a uno.
  const pe = ngon(...C12, 72, 5)
  const pi = ngon(...C12, 34, 5)
  const d12 = {
    outline: poly(pe),
    inner: [`M${poly(pi)} Z`, ...pe.map((v, i) => line(v, pi[i]))].join(' '),
    hatch: poly(pi)
  }
  return { d20, cube, d4, d8, d12 }
}

function svg() {
  const d = dice()
  // Collegamenti: ogni dado col d20, più due archi laterali.
  const links = [
    line(C6, C20),
    line(C4, C20),
    line(C8, C20),
    line(C12, C20),
    `M${pt(C6)} Q${pt([256, 36])} ${pt(C4)}`,
    `M${pt(C8)} Q${pt([256, 478])} ${pt(C12)}`
  ]
  const shape = (s) => `
    <polygon points="${s.outline}" fill="${PAPER}" stroke="none"/>
    <polygon points="${s.hatch}" fill="url(#hatch)" stroke="none"/>
    <path d="${s.inner}" fill="none"/>
    <polygon points="${s.outline}" fill="none" stroke-width="5.5"/>`
  const group = (seed, opacity, width) => `
  <g filter="url(#wobble${seed})" opacity="${opacity}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${links.map((l) => `<path d="${l}"/>`).join('')}
    ${Object.values(d).map(shape).join('')}
  </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="wobble1" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="wobble2" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves="2" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.42 -0.12"/>
    </filter>
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="${INK}" stroke-width="2" opacity="0.55"/>
    </pattern>
    <clipPath id="card"><rect x="14" y="14" width="484" height="484" rx="96"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="512" height="512" fill="${PAPER}"/>
    <rect width="512" height="512" filter="url(#grain)"/>
    ${group(2, 0.5, 4)}
    ${group(1, 0.92, 5)}
  </g>
  <rect x="14" y="14" width="484" height="484" rx="96" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="3"/>
</svg>`
}

/** ICO con immagini PNG incorporate (valido da Windows Vista in poi). */
function ico(images) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = 6 + dir.length
  images.forEach(({ size, png }, i) => {
    dir.writeUInt8(size >= 256 ? 0 : size, i * 16)
    dir.writeUInt8(size >= 256 ? 0 : size, i * 16 + 1)
    dir.writeUInt16LE(1, i * 16 + 4)
    dir.writeUInt16LE(32, i * 16 + 6)
    dir.writeUInt32LE(png.length, i * 16 + 8)
    dir.writeUInt32LE(offset, i * 16 + 12)
    offset += png.length
  })
  return Buffer.concat([head, dir, ...images.map((i) => i.png)])
}

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true })
  const source = svg()
  writeFileSync(join(OUT, 'icon.svg'), source)
  const win = new BrowserWindow({ width: 512, height: 512, useContentSize: true, show: false, frame: false, transparent: true, webPreferences: { offscreen: false } })
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block;width:512px;height:512px}</style><img src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}">`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise((r) => setTimeout(r, 600))
  const full = await win.webContents.capturePage()
  const { width, height } = full.getSize()
  const corner = full.toBitmap().readUInt8(3)
  console.log(`catturata ${width}x${height}, alfa nell'angolo: ${corner}`)
  writeFileSync(join(OUT, 'icon.png'), full.toPNG())
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const images = sizes.map((size) => ({ size, png: nativeImage.createFromBuffer(full.toPNG()).resize({ width: size, height: size, quality: 'best' }).toPNG() }))
  writeFileSync(join(OUT, 'icon.ico'), ico(images))
  console.log('scritti build/icon.svg, icon.png, icon.ico')
  app.quit()
})
