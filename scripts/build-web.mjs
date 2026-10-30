import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const temp = path.join(root, '.build-temp-web')
try {
  rmSync(temp, { recursive: true, force: true })
} catch {
  // A previous process can briefly hold a file.
}
mkdirSync(temp, { recursive: true })

const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.web.config.ts'],
  {
    cwd: root,
    env: { ...process.env, TEMP: temp, TMP: temp },
    stdio: 'inherit'
  }
)

process.exit(result.status ?? 1)
