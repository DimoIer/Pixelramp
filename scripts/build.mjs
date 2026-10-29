import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const temp = path.join(root, '.build-temp')
try {
  rmSync(temp, { recursive: true, force: true })
} catch {
  // A previously running tool can hold a temp file briefly.
}
mkdirSync(temp, { recursive: true })

const env = {
  ...process.env,
  TEMP: temp,
  TMP: temp
}

const steps = [
  ['node_modules/typescript/bin/tsc', ['-p', 'tsconfig.node.json', '--noEmit']],
  ['node_modules/typescript/bin/tsc', ['-p', 'tsconfig.web.json', '--noEmit']],
  ['node_modules/electron-vite/bin/electron-vite.js', ['build']]
]

for (const [script, args] of steps) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log('\nPixelRamp build complete → out/')
