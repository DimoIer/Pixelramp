import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { zipSync } from 'fflate'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const exe = path.join(root, 'src-tauri/target/release/pixelramp.exe')
if (!existsSync(exe)) {
  console.error('Missing release executable. Run `npm run build:tauri` first.')
  process.exit(1)
}

const outDir = path.join(root, `release/PixelRamp-${version}`)
const archive = path.join(root, `release/PixelRamp-${version}-win-x64.zip`)
rmSync(outDir, { recursive: true, force: true })
rmSync(archive, { force: true })
mkdirSync(outDir, { recursive: true })

copyFileSync(exe, path.join(outDir, 'PixelRamp.exe'))
copyFileSync(path.join(root, 'build/PixelRamp-tauri.cmd'), path.join(outDir, 'PixelRamp.cmd'))
copyFileSync(path.join(root, 'build/PORTABLE-TAURI-README.txt'), path.join(outDir, 'README.txt'))
copyFileSync(path.join(root, 'LICENSE'), path.join(outDir, 'LICENSE'))

const entries = {}
for (const name of ['PixelRamp.exe', 'PixelRamp.cmd', 'README.txt', 'LICENSE']) {
  entries[name] = readFileSync(path.join(outDir, name))
}
const zipped = zipSync(entries, { level: 9 })
writeFileSync(archive, zipped)
console.log(`Portable app: ${outDir}`)
console.log(`ZIP: ${archive} (${(zipped.byteLength / 1024 / 1024).toFixed(2)} MB)`)
