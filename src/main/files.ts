import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import type { FileFilter, FileKind, OpenedFile, SaveFileRequest } from '../shared/types'
import type { RecentStore } from './recent'

const IMAGE_FILTERS: FileFilter[] = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] }
]
const PROJECT_FILTERS: FileFilter[] = [{ name: 'PixelRamp project', extensions: ['pxramp'] }]
const JSON_FILTERS: FileFilter[] = [{ name: 'Palette JSON', extensions: ['json'] }]

const MAX_READ_BYTES = 128 * 1024 * 1024
const MAX_WRITE_BYTES = 256 * 1024 * 1024

export type OpenKind = 'image' | 'project' | 'any' | 'json' | 'paletteImage'

function filtersFor(kind: OpenKind): FileFilter[] {
  switch (kind) {
    case 'project':
      return PROJECT_FILTERS
    case 'json':
      return JSON_FILTERS
    case 'image':
    case 'paletteImage':
      return IMAGE_FILTERS
    case 'any':
    default:
      return [...IMAGE_FILTERS, ...PROJECT_FILTERS]
  }
}

export function detectKind(filePath: string): FileKind {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pxramp') return 'project'
  if (['.png', '.jpg', '.jpeg', '.bmp', '.gif'].includes(ext)) return 'image'
  if (ext === '.json') return 'json'
  return 'unknown'
}

function safeName(name: string, fallback: string): string {
  const base = path.basename(name || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim()
  return base.length > 0 ? base.slice(0, 180) : fallback
}

function ensureExtension(filePath: string, filters: FileFilter[]): string {
  if (path.extname(filePath)) return filePath
  const ext = filters[0]?.extensions[0]
  return ext ? `${filePath}.${ext}` : filePath
}

async function readOpenFile(filePath: string): Promise<OpenedFile> {
  const stat = await fs.stat(filePath)
  if (!stat.isFile()) throw new Error('The selected path is not a file.')
  if (stat.size > MAX_READ_BYTES) throw new Error('This file is too large to open (128 MB limit).')
  const data = await fs.readFile(filePath)
  return {
    path: filePath,
    name: path.basename(filePath),
    kind: detectKind(filePath),
    bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
}

export class FileBridge {
  private readonly recent: RecentStore

  constructor(recent: RecentStore) {
    this.recent = recent
  }

  async open(window: BrowserWindow | null, kind: OpenKind): Promise<OpenedFile | null> {
    const options: Electron.OpenDialogOptions = {
      title:
        kind === 'project'
          ? 'Open PixelRamp project'
          : kind === 'json'
            ? 'Import palette JSON'
            : kind === 'paletteImage'
              ? 'Import palette from image'
              : 'Open image or project',
      properties: ['openFile'],
      filters: filtersFor(kind),
      defaultPath: app.getPath('pictures')
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    const opened = await readOpenFile(result.filePaths[0])
    if (kind !== 'json' && kind !== 'paletteImage') await this.recent.add(opened.path, opened.kind)
    return opened
  }

  async openPath(filePath: string): Promise<OpenedFile | null> {
    if (typeof filePath !== 'string' || filePath.length === 0) return null
    const opened = await readOpenFile(filePath)
    await this.recent.add(opened.path, opened.kind)
    return opened
  }

  async save(window: BrowserWindow | null, request: SaveFileRequest): Promise<string | null> {
    if (!request || !(request.bytes instanceof Uint8Array)) {
      throw new Error('No file data was supplied.')
    }
    if (request.bytes.byteLength > MAX_WRITE_BYTES) throw new Error('The file is too large to save.')
    const filters = request.filters && request.filters.length > 0 ? request.filters : IMAGE_FILTERS
    let target = request.currentPath ?? null

    if (!target || request.saveAs) {
      const suggested = safeName(request.suggestedName, 'pixelramp-export.png')
      const defaultPath = target ?? path.join(app.getPath('pictures'), suggested)
      const options: Electron.SaveDialogOptions = {
        title: request.title ?? 'Save file',
        defaultPath,
        filters,
        properties: ['createDirectory', 'showOverwriteConfirmation']
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return null
      target = result.filePath
    }

    target = ensureExtension(target, filters)
    const directory = path.dirname(target)
    await fs.mkdir(directory, { recursive: true })
    const tempPath = path.join(directory, `.${path.basename(target)}.${process.pid}.tmp`)
    await fs.writeFile(tempPath, request.bytes)
    try {
      await fs.rename(tempPath, target)
    } catch {
      await fs.rm(target, { force: true })
      await fs.rename(tempPath, target)
    }
    return target
  }

  reveal(filePath: string): void {
    if (typeof filePath === 'string' && filePath.length > 0) shell.showItemInFolder(filePath)
  }
}
