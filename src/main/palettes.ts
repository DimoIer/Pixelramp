import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Palette } from '../shared/types'

interface IndexFile {
  version: 1
  ids: string[]
}

const INDEX_FILE = 'index.json'

function isPalette(value: unknown): value is Palette {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Palette>
  return (
    typeof candidate.id === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(candidate.id) &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.colors) &&
    candidate.colors.length > 0 &&
    candidate.colors.length <= 100000 &&
    candidate.colors.every(
      (color) =>
        color &&
        typeof color === 'object' &&
        color.rgba &&
        typeof color.rgba.r === 'number' &&
        typeof color.rgba.g === 'number' &&
        typeof color.rgba.b === 'number' &&
        typeof color.rgba.a === 'number'
    ) &&
    typeof candidate.source === 'string' &&
    ['generated', 'extracted', 'manual'].includes(candidate.source) &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  )
}

async function readIndex(dir: string): Promise<string[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(dir, INDEX_FILE), 'utf8')) as IndexFile
    if (parsed && Array.isArray(parsed.ids)) {
      return parsed.ids.filter((id): id is string => typeof id === 'string')
    }
  } catch {
    // No index yet.
  }
  return []
}

async function writeIndex(dir: string, ids: string[]): Promise<void> {
  const index: IndexFile = { version: 1, ids }
  await fs.writeFile(path.join(dir, INDEX_FILE), JSON.stringify(index, null, 2), 'utf8')
}

async function readPaletteFile(dir: string, id: string): Promise<Palette | null> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(id)) return null
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), 'utf8'))
    return isPalette(raw) ? raw : null
  } catch {
    return null
  }
}

export class PaletteStore {
  private readonly dir: string

  constructor(userDataDir: string) {
    this.dir = path.join(userDataDir, 'palettes')
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
  }

  async list(): Promise<Palette[]> {
    await this.init()
    const ids = await readIndex(this.dir)
    const files = await fs.readdir(this.dir).catch(() => [] as string[])
    const fileIds = files
      .filter((file) => file.endsWith('.json') && file !== INDEX_FILE)
      .map((file) => file.slice(0, -5))
    const ordered = [...new Set([...ids, ...fileIds])]
    const palettes = (
      await Promise.all(ordered.map((id) => readPaletteFile(this.dir, id)))
    ).filter((palette): palette is Palette => palette !== null)
    palettes.sort((a, b) => b.updatedAt - a.updatedAt)

    const resolvedIds = palettes.map((palette) => palette.id)
    if (resolvedIds.join('|') !== ids.join('|')) await writeIndex(this.dir, resolvedIds)
    return palettes
  }

  async save(palette: Palette): Promise<Palette[]> {
    await this.init()
    if (!isPalette(palette)) throw new Error('Refusing to save an invalid palette object.')
    const fileName = `${palette.id}.json`
    const filePath = path.join(this.dir, fileName)
    const tempPath = `${filePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(palette, null, 2), 'utf8')
    await fs.rename(tempPath, filePath).catch(async () => {
      await fs.rm(filePath, { force: true })
      await fs.rename(tempPath, filePath)
    })
    const ids = await readIndex(this.dir)
    const nextIds = [palette.id, ...ids.filter((id) => id !== palette.id)]
    await writeIndex(this.dir, nextIds)
    return this.list()
  }

  async remove(id: string): Promise<Palette[]> {
    await this.init()
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(id)) throw new Error('Invalid palette id.')
    await fs.rm(path.join(this.dir, `${id}.json`), { force: true })
    const ids = await readIndex(this.dir)
    await writeIndex(
      this.dir,
      ids.filter((entry) => entry !== id)
    )
    return this.list()
  }
}
