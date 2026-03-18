const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.platform === 'win32') {
  try {
    execSync('taskkill /IM FloorCraft.exe /F', { stdio: 'ignore' })
  } catch {}
}
try {
  const release = path.join(__dirname, '..', 'release')
  if (fs.existsSync(release)) fs.rmSync(release, { recursive: true })
} catch {}
