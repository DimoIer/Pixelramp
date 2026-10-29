import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { FileKind, RecentFile } from '../shared/types'

interface RecentFileData {
  version: 1
  entries: RecentFile[]
}

const MAX_RECENT = 12

export class RecentStore {
  private readonly file: string

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'recent.json')
  }

  async read(): Promise<RecentFile[]> {
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8')) as RecentFileData
      if (!data || !Array.isArray(data.entries)) return []
      return data.entries
        .filter(
          (entry): entry is RecentFile =>
            !!entry &&
            typeof entry.path === 'string' &&
            typeof entry.name === 'string' &&
            typeof entry.openedAt === 'number' &&
            ['image', 'project', 'json', 'unknown'].includes(entry.kind)
        )
        .sort((a, b) => b.openedAt - a.openedAt)
        .slice(0, MAX_RECENT)
    } catch {
      return []
    }
  }

  async add(filePath: string, kind: FileKind): Promise<void> {
    if (kind !== 'image' && kind !== 'project') return
    const entries = await this.read()
    const next: RecentFile[] = [
      { path: filePath, name: path.basename(filePath), kind, openedAt: Date.now() },
      ...entries.filter((entry) => entry.path.toLowerCase() !== filePath.toLowerCase())
    ].slice(0, MAX_RECENT)
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await fs.writeFile(this.file, JSON.stringify({ version: 1, entries: next }, null, 2), 'utf8')
  }

  async list(): Promise<RecentFile[]> {
    const entries = await this.read()
    const existing: RecentFile[] = []
    for (const entry of entries) {
      try {
        await fs.access(entry.path)
        existing.push(entry)
      } catch {
        // Skip files that have moved or been deleted.
      }
    }
    return existing
  }

  async clear(): Promise<void> {
    await fs.rm(this.file, { force: true })
  }
}
