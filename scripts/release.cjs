// Pubblica una release su GitHub. Usa GH_TOKEN se impostato, altrimenti il login di `gh`.
const { execSync, spawnSync } = require('node:child_process')

if (!process.env.GH_TOKEN) {
  try {
    process.env.GH_TOKEN = execSync('gh auth token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    // gh assente o non autenticato: gestito sotto
  }
}
if (!process.env.GH_TOKEN) {
  console.error('Nessun token GitHub. Esegui `gh auth login` oppure imposta GH_TOKEN (vedi README).')
  process.exit(1)
}

const r = spawnSync('npx electron-vite build && npx electron-builder --win --publish always', {
  stdio: 'inherit',
  shell: true,
  env: process.env
})
process.exit(r.status ?? 1)
